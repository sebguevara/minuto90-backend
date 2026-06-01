import { CronJob } from "cron";
import { insightsService } from "../features/insights/application/insights.service";
import { footballService } from "../features/sports/application/football.service";
import { isFeaturedCompetitionId } from "../features/insights/infrastructure/featured-competition-priority";
import {
  getFootballOddsExtendedFutureRefreshCron,
  getFootballOddsHistoryFutureDays,
  getFootballOddsNearFutureDays,
  getFootballOddsNearFutureRefreshCron,
  getFootballOddsTodayRefreshCron,
  getFootballOddsTodayRefreshHalfStepCron,
} from "../features/sports/infrastructure/football-cache-ttl";
import { logError, logInfo, logWarn } from "../shared/logging/logger";
import { mapWithConcurrency } from "./util/map-with-concurrency";

const DEFAULT_TIMEZONE = "UTC";
const FEATURED_MATCHES_LIMIT = 8;

// ── AI features (key insights + re-ranking) config ──────────────────────────
const KEY_INSIGHTS_ENABLED =
  (process.env.KEY_INSIGHTS_ENABLED?.trim() || "true") !== "false";
// "featured" = only the ~8 featured matches; "featured_competitions" = all fixtures in
// featured leagues (default); "all_day" = every fixture of the day.
const KEY_INSIGHTS_SCOPE = (
  process.env.KEY_INSIGHTS_SCOPE?.trim() || "featured_competitions"
).toLowerCase();
const KEY_INSIGHTS_CONCURRENCY = Math.max(
  1,
  Math.min(8, Number(process.env.KEY_INSIGHTS_CONCURRENCY) || 4)
);
const KEY_INSIGHTS_MAX_PER_DATE = Math.max(
  1,
  Number(process.env.KEY_INSIGHTS_MAX_PER_DATE) || 150
);
const FEATURED_AI_RANKING_ENABLED =
  (process.env.FEATURED_AI_RANKING_ENABLED?.trim() || "false") === "true";
const FEATURED_MATCHES_CRON_TIMEZONE =
  process.env.FOOTBALL_FEATURED_MATCHES_CRON_TIMEZONE?.trim() || DEFAULT_TIMEZONE;
// Default: true. La precarga al arrancar es lo que garantiza que la primera
// request del frontend encuentre destacados en caché. Sólo se desactiva si
// FOOTBALL_FEATURED_MATCHES_RUN_ON_STARTUP="false" se setea explícitamente.
const FEATURED_MATCHES_RUN_ON_STARTUP =
  (process.env.FOOTBALL_FEATURED_MATCHES_RUN_ON_STARTUP?.trim() || "true") !== "false";

function formatUtcDateKey(offsetDays = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function buildOffsetRange(fromOffset: number, toOffset: number) {
  const out: string[] = [];
  for (let offset = fromOffset; offset <= toOffset; offset += 1) {
    out.push(formatUtcDateKey(offset));
  }
  return out;
}

async function refreshFeaturedRange(label: string, dates: string[]) {
  let refreshed = 0;

  for (const date of dates) {
    try {
      // Always warm the deterministic cache here, independent of the AI-ranking flag.
      await insightsService.getFeaturedMatches(
        date,
        FEATURED_MATCHES_LIMIT,
        null,
        undefined,
        { skipAiRanked: true }
      );
      refreshed += 1;
    } catch (error) {
      logWarn("worker.football.featured.range_refresh.date_failed", {
        label,
        date,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logInfo("worker.football.featured.range_refresh.done", {
    label,
    dates,
    refreshed,
  });
}

const KEY_INSIGHTS_FINISHED_STATUS = new Set([
  "FT",
  "AET",
  "PEN",
  "AWD",
  "WO",
  "CANC",
  "ABD",
  "PST",
]);

async function resolveKeyInsightFixtureIds(date: string): Promise<number[]> {
  if (KEY_INSIGHTS_SCOPE === "featured") {
    const featured = await insightsService.getFeaturedMatches(
      date,
      FEATURED_MATCHES_LIMIT
    );
    return featured
      .filter((m) => !KEY_INSIGHTS_FINISHED_STATUS.has((m.status ?? "").toUpperCase()))
      .map((m) => m.fixtureId);
  }

  const fixturesRes = await footballService.getFixtures({ date });
  const all = fixturesRes.response ?? [];
  const scoped =
    KEY_INSIGHTS_SCOPE === "all_day"
      ? all
      : all.filter((f) => isFeaturedCompetitionId(f.league.id));
  return scoped
    .filter(
      (f) =>
        !KEY_INSIGHTS_FINISHED_STATUS.has(
          (f.fixture.status.short ?? "").toUpperCase()
        )
    )
    .map((f) => f.fixture.id)
    .filter((id): id is number => typeof id === "number");
}

/**
 * Pre-generates key insights for a date so they're cached and ready the instant a match
 * goes live. Bounded concurrency + per-date cap + skip-already-cached for cost control.
 */
async function prewarmKeyInsightsForDate(date: string) {
  if (!KEY_INSIGHTS_ENABLED) return;

  let ids: number[];
  try {
    ids = await resolveKeyInsightFixtureIds(date);
  } catch (error) {
    logWarn("worker.football.key_insights.resolve_failed", {
      date,
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  if (ids.length === 0) return;

  // Skip fixtures that already have a cached insight (no re-spend on reruns).
  const cached = await insightsService.getCachedKeyInsightsByIds(ids);
  const pending = ids
    .filter((id) => !cached[id])
    .slice(0, KEY_INSIGHTS_MAX_PER_DATE);

  if (pending.length === 0) {
    logInfo("worker.football.key_insights.nothing_pending", {
      date,
      total: ids.length,
    });
    return;
  }

  const results = await mapWithConcurrency(
    pending,
    KEY_INSIGHTS_CONCURRENCY,
    (id) => insightsService.getKeyInsight(id)
  );
  const generated = results.filter(
    (r) => r.status === "fulfilled" && r.value
  ).length;
  const failed = results.filter((r) => r.status === "rejected").length;

  logInfo("worker.football.key_insights.prewarm_done", {
    date,
    scope: KEY_INSIGHTS_SCOPE,
    total: ids.length,
    pending: pending.length,
    generated,
    failed,
  });
}

async function refreshAiRankedFeaturedForDate(date: string) {
  if (!FEATURED_AI_RANKING_ENABLED) return;
  try {
    await insightsService.computeAndCacheAiRankedFeatured(date, FEATURED_MATCHES_LIMIT);
  } catch (error) {
    logWarn("worker.football.featured.ai_rank_failed", {
      date,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function refreshTodayFeaturedMatches() {
  // Pre-warm yesterday, today, and tomorrow (UTC) to cover all user timezones
  await refreshFeaturedRange("today", [
    formatUtcDateKey(-1),
    formatUtcDateKey(0),
    formatUtcDateKey(1),
  ]);

  // AI features (re-ranking + key insights) only for today and tomorrow — cost control.
  // Deterministic order is already warm above, so re-ranking reads it cheaply.
  for (const date of [formatUtcDateKey(0), formatUtcDateKey(1)]) {
    await refreshAiRankedFeaturedForDate(date);
    await prewarmKeyInsightsForDate(date);
  }
}

async function refreshNearFutureFeaturedMatches() {
  return refreshFeaturedRange("near_future", buildOffsetRange(1, getFootballOddsNearFutureDays()));
}

async function refreshExtendedFutureFeaturedMatches() {
  const nearFutureDays = getFootballOddsNearFutureDays();
  const futureDays = getFootballOddsHistoryFutureDays();
  if (futureDays <= nearFutureDays) {
    return;
  }
  return refreshFeaturedRange(
    "extended_future",
    buildOffsetRange(nearFutureDays + 1, futureDays)
  );
}

async function bootstrapFeaturedRefreshes() {
  await Promise.allSettled([
    refreshTodayFeaturedMatches(),
    refreshNearFutureFeaturedMatches(),
    refreshExtendedFutureFeaturedMatches(),
  ]);
}

if (FEATURED_MATCHES_RUN_ON_STARTUP) {
  bootstrapFeaturedRefreshes().catch((error) => {
    logError("worker.football.featured.refresh.bootstrap_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  });
} else {
  logInfo("worker.football.featured.refresh.startup_skipped", {
    reason: "scheduled_only",
  });
}

const scheduleRefresh = (cronExpression: string, runner: () => Promise<void>, label: string) =>
  new CronJob(
    cronExpression,
    () => {
      runner().catch((error) => {
        logError("worker.football.featured.refresh.cron_failed", {
          label,
          cronExpression,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    },
    null,
    true,
    FEATURED_MATCHES_CRON_TIMEZONE
  );

scheduleRefresh(getFootballOddsTodayRefreshCron(), refreshTodayFeaturedMatches, "today");
scheduleRefresh(
  getFootballOddsTodayRefreshHalfStepCron(),
  refreshTodayFeaturedMatches,
  "today-halfstep"
);
scheduleRefresh(
  getFootballOddsNearFutureRefreshCron(),
  refreshNearFutureFeaturedMatches,
  "near_future"
);
scheduleRefresh(
  getFootballOddsExtendedFutureRefreshCron(),
  refreshExtendedFutureFeaturedMatches,
  "extended_future"
);
