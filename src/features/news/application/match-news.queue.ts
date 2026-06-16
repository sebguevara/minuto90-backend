import { Queue } from "bullmq";
import { redisConnection } from "../../../shared/redis/redis.connection";
import { logInfo } from "../../../shared/logging/logger";
import {
  getPostMatchNewsDelayMs,
  isPostMatchNewsEnabled,
} from "../../../shared/config/postmatch-news";

export const MATCH_NEWS_QUEUE_NAME = "match-news-generation";

export type MatchNewsGenerationJob = {
  fixtureId: number;
  leagueId?: number;
  season?: number;
};

export const matchNewsQueue = new Queue<MatchNewsGenerationJob>(MATCH_NEWS_QUEUE_NAME, {
  connection: redisConnection,
});

/**
 * Enqueues a single post-match news generation job. Idempotent at the queue level via
 * a deterministic jobId (`match-news:<fixtureId>`): repeated FULL_TIME signals for the
 * same fixture collapse into one job. No-op when the feature flag is off.
 */
export async function enqueueMatchNewsGeneration(job: MatchNewsGenerationJob): Promise<void> {
  if (!isPostMatchNewsEnabled()) return;

  const jobId = `match-news:${job.fixtureId}`;
  await matchNewsQueue.add("generate", job, {
    jobId,
    delay: getPostMatchNewsDelayMs(),
    removeOnComplete: 1000,
    removeOnFail: 500,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  });

  if (process.env.NOTIFICATIONS_DEBUG === "true") {
    logInfo("postmatch_news.enqueued", {
      jobId,
      fixtureId: job.fixtureId,
      leagueId: job.leagueId ?? null,
    });
  }
}
