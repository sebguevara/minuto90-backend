import { CronJob } from "cron";
import { insightsService } from "../features/insights/application/insights.service";
import { pushService } from "../features/push/application/push.service";
import { logError, logInfo } from "../shared/logging/logger";

const CRON_SCHEDULE =
  process.env.FEATURED_MATCH_KICKOFF_PUSH_CRON?.trim() || "*/2 * * * *";
const CRON_TIMEZONE =
  process.env.FEATURED_MATCH_KICKOFF_PUSH_TIMEZONE?.trim() || "UTC";

/**
 * API-Football status codes that indicate a match is currently in play.
 * We send the push notification the first time one of these statuses is detected.
 */
const LIVE_STATUSES = new Set(["1H", "2H", "ET", "P", "BT", "HT", "LIVE"]);

function isMatchLive(status: string) {
  return LIVE_STATUSES.has(status.toUpperCase());
}

function formatUtcDateKey() {
  return new Date().toISOString().slice(0, 10);
}

async function runFeaturedMatchKickoffPoller() {
  const today = formatUtcDateKey();

  let matches;
  try {
    matches = await insightsService.getFeaturedMatches(today, 30);
  } catch (err) {
    logError("push.match.kickoff.poller.fetch_failed", {
      date: today,
      err: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  let enqueued = 0;

  for (const match of matches) {
    if (!isMatchLive(match.status)) continue;

    try {
      const result = await pushService.enqueueFeaturedMatchKickoffPush(match);
      if (result.status === "enqueued") {
        enqueued += 1;
      }
    } catch (err) {
      logError("push.match.kickoff.enqueue_failed", {
        fixtureId: match.fixtureId,
        home: match.homeTeam.name,
        away: match.awayTeam.name,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (enqueued > 0) {
    logInfo("push.match.kickoff.poller.done", {
      date: today,
      totalFeatured: matches.length,
      enqueued,
    });
  }
}

const job = new CronJob(
  CRON_SCHEDULE,
  () => {
    runFeaturedMatchKickoffPoller().catch((err) => {
      logError("push.match.kickoff.poller.failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    });
  },
  null,
  false,
  CRON_TIMEZONE
);

job.start();

logInfo("push.match.kickoff.poller.started", {
  schedule: CRON_SCHEDULE,
  timezone: CRON_TIMEZONE,
  trigger: "first-live-status-detection",
});
