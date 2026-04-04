import { CronJob } from "cron";
import { DEFAULT_ODDS_BET } from "../features/sports/infrastructure/football-odds-cache";
import {
  getFootballOddsExtendedFutureRefreshCron,
  getFootballOddsHistoryFutureDays,
  getFootballOddsNearFutureDays,
  getFootballOddsNearFutureRefreshCron,
  getFootballOddsTodayRefreshCron,
  getFootballOddsTodayRefreshHalfStepCron,
} from "../features/sports/infrastructure/football-cache-ttl";
import { refreshOddsSnapshotForDate } from "../features/sports/infrastructure/football-odds-hydration";
import { logError, logInfo, logWarn } from "../shared/logging/logger";

const DEFAULT_TIMEZONE = "UTC";
const FOOTBALL_ODDS_CRON_TIMEZONE =
  process.env.FOOTBALL_ODDS_CRON_TIMEZONE?.trim() || DEFAULT_TIMEZONE;
const FOOTBALL_ODDS_RUN_ON_STARTUP =
  process.env.FOOTBALL_ODDS_RUN_ON_STARTUP?.trim() === "true";

function formatUtcDateKey(offsetDays = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function buildOffsetRange(fromOffset: number, toOffset: number) {
  const out: string[] = [];
  for (let offset = fromOffset; offset <= toOffset; offset++) {
    out.push(formatUtcDateKey(offset));
  }
  return out;
}

async function refreshOddsRange(label: string, dates: string[]) {
  let refreshed = 0;
  let written = 0;

  for (const date of dates) {
    try {
      const result = await refreshOddsSnapshotForDate(date, DEFAULT_TIMEZONE, DEFAULT_ODDS_BET);
      refreshed += result.refreshed ? 1 : 0;
      written += result.written;
    } catch (error) {
      logWarn("worker.football.odds.range_refresh.date_failed", {
        label,
        date,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logInfo("worker.football.odds.range_refresh.done", {
    label,
    dates,
    refreshed,
    written,
  });
}

async function refreshTodayOddsSnapshot() {
  return refreshOddsRange("today", [formatUtcDateKey(0)]);
}

async function refreshNearFutureOddsSnapshots() {
  return refreshOddsRange("near_future", buildOffsetRange(1, getFootballOddsNearFutureDays()));
}

async function refreshExtendedFutureOddsSnapshots() {
  const nearFutureDays = getFootballOddsNearFutureDays();
  const futureDays = getFootballOddsHistoryFutureDays();
  if (futureDays <= nearFutureDays) {
    return;
  }
  return refreshOddsRange("extended_future", buildOffsetRange(nearFutureDays + 1, futureDays));
}

async function bootstrapOddsRefreshes() {
  await Promise.allSettled([
    refreshTodayOddsSnapshot(),
    refreshNearFutureOddsSnapshots(),
    refreshExtendedFutureOddsSnapshots(),
  ]);
}

if (FOOTBALL_ODDS_RUN_ON_STARTUP) {
  bootstrapOddsRefreshes().catch((error) => {
    logError("worker.football.odds.refresh.bootstrap_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  });
} else {
  logInfo("worker.football.odds.refresh.startup_skipped", {
    reason: "scheduled_only",
  });
}

const scheduleRefresh = (cronExpression: string, runner: () => Promise<void>, label: string) =>
  new CronJob(
    cronExpression,
    () => {
      runner().catch((error) => {
        logError("worker.football.odds.refresh.cron_failed", {
          label,
          cronExpression,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    },
    null,
    true,
    FOOTBALL_ODDS_CRON_TIMEZONE
  );

scheduleRefresh(getFootballOddsTodayRefreshCron(), refreshTodayOddsSnapshot, "today");
scheduleRefresh(getFootballOddsTodayRefreshHalfStepCron(), refreshTodayOddsSnapshot, "today-halfstep");
scheduleRefresh(getFootballOddsNearFutureRefreshCron(), refreshNearFutureOddsSnapshots, "near_future");
scheduleRefresh(
  getFootballOddsExtendedFutureRefreshCron(),
  refreshExtendedFutureOddsSnapshots,
  "extended_future"
);
