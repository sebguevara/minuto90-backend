import { Worker } from "bullmq";
import { redisConnection } from "../shared/redis/redis.connection";
import { logError, logInfo } from "../shared/logging/logger";
import {
  MATCH_NEWS_QUEUE_NAME,
  type MatchNewsGenerationJob,
} from "../features/news/application/match-news.queue";
import { generateMatchNewsDraft } from "../features/news/application/match-news.service";
import { isPostMatchNewsEnabled } from "../shared/config/postmatch-news";

const worker = new Worker<MatchNewsGenerationJob>(
  MATCH_NEWS_QUEUE_NAME,
  async (job) => {
    if (!isPostMatchNewsEnabled()) return;

    const { fixtureId } = job.data;
    const result = await generateMatchNewsDraft(fixtureId);

    logInfo("postmatch_news.worker.processed", {
      jobId: job.id,
      fixtureId,
      status: result.status,
      reason: result.status === "skipped" ? result.reason : undefined,
      newsId: result.status !== "skipped" ? result.newsId : undefined,
    });
  },
  {
    connection: redisConnection,
    // Low concurrency: each job is an LLM call; keep spend + rate predictable.
    concurrency: Number(process.env.POSTMATCH_NEWS_WORKER_CONCURRENCY ?? 2),
  }
);

worker.on("failed", (job, err) => {
  logError("postmatch_news.worker.failed", {
    jobId: job?.id,
    fixtureId: job?.data?.fixtureId,
    attemptsMade: job?.attemptsMade,
    err: err?.message ?? String(err),
  });
});

logInfo("postmatch_news.worker.started");
