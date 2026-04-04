import { CronJob } from "cron";
import { insightsService } from "../features/insights/application/insights.service";
import {
  getFootballOddsExtendedFutureRefreshCron,
  getFootballOddsHistoryFutureDays,
  getFootballOddsNearFutureDays,
  getFootballOddsNearFutureRefreshCron,
  getFootballOddsTodayRefreshCron,
  getFootballOddsTodayRefreshHalfStepCron,
} from "../features/sports/infrastructure/football-cache-ttl";
import { logError, logInfo, logWarn } from "../shared/logging/logger";

const DEFAULT_TIMEZONE = "UTC";
const FEATURED_MATCHES_LIMIT = 8;
const FEATURED_MATCHES_CRON_TIMEZONE =
  process.env.FOOTBALL_FEATURED_MATCHES_CRON_TIMEZONE?.trim() || DEFAULT_TIMEZONE;

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
      await insightsService.getFeaturedMatches(date, FEATURED_MATCHES_LIMIT);
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

async function refreshTodayFeaturedMatches() {
  return refreshFeaturedRange("today", [formatUtcDateKey(0)]);
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

bootstrapFeaturedRefreshes().catch((error) => {
  logError("worker.football.featured.refresh.bootstrap_failed", {
    error: error instanceof Error ? error.message : String(error),
  });
});

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
