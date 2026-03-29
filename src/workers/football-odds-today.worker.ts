import { CronJob } from "cron";
import {
  DEFAULT_ODDS_BET,
} from "../features/sports/infrastructure/football-odds-cache";
import {
  getFootballOddsTodayRefreshCron,
} from "../features/sports/infrastructure/football-cache-ttl";
import { refreshOddsSnapshotForDate } from "../features/sports/infrastructure/football-odds-hydration";
import { logError, logInfo, logWarn } from "../shared/logging/logger";

const DEFAULT_TIMEZONE = "UTC";
const FOOTBALL_ODDS_TODAY_CRON_TIMEZONE =
  process.env.FOOTBALL_ODDS_TODAY_CRON_TIMEZONE?.trim() || DEFAULT_TIMEZONE;

function todayUtcDateKey() {
  return new Date().toISOString().slice(0, 10);
}

async function refreshTodayOddsSnapshot() {
  const date = todayUtcDateKey();
  try {
    const result = await refreshOddsSnapshotForDate(date, DEFAULT_TIMEZONE, DEFAULT_ODDS_BET);
    logInfo("worker.football.odds.today_refresh.done", {
      date,
      written: result.written,
      refreshed: result.refreshed,
      skipped: result.skipped ?? null,
    });
  } catch (error) {
    logWarn("worker.football.odds.today_refresh.failed", {
      date,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

refreshTodayOddsSnapshot().catch((error) => {
  logError("worker.football.odds.today_refresh.bootstrap_failed", {
    error: error instanceof Error ? error.message : String(error),
  });
});

new CronJob(
  getFootballOddsTodayRefreshCron(),
  () => {
    refreshTodayOddsSnapshot().catch((error) => {
      logError("worker.football.odds.today_refresh.cron_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  },
  null,
  true,
  FOOTBALL_ODDS_TODAY_CRON_TIMEZONE
);
