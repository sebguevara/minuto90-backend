import { CronJob } from "cron";
import { pushService } from "../features/push/application/push.service";
import { logError, logInfo } from "../shared/logging/logger";

const NEWS_PUSH_CRON_SCHEDULE =
  process.env.NEWS_PUSH_CRON_SCHEDULE?.trim() || "*/1 * * * *";
const NEWS_PUSH_CRON_TIMEZONE =
  process.env.NEWS_PUSH_CRON_TIMEZONE?.trim() || "UTC";

async function runNewsPublicationPoller() {
  const startedAt = Date.now();
  const result = await pushService.enqueuePendingPublishedNews();

  logInfo("push.news.poller.done", {
    scanned: result.scanned,
    enqueued: result.enqueued,
    durationMs: Date.now() - startedAt,
  });
}

const job = new CronJob(
  NEWS_PUSH_CRON_SCHEDULE,
  () => {
    runNewsPublicationPoller().catch((err) => {
      logError("push.news.poller.failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    });
  },
  null,
  false,
  NEWS_PUSH_CRON_TIMEZONE
);

job.start();

logInfo("push.news.poller.started", {
  schedule: NEWS_PUSH_CRON_SCHEDULE,
  timezone: NEWS_PUSH_CRON_TIMEZONE,
});
