import { Queue } from "bullmq";
import { redisConnection } from "../../shared/redis/redis.connection";

export type WebPushNewsJob = {
  newsId: string;
  subscriptionId: string;
  payload: string;
};

export const webPushQueue = new Queue<WebPushNewsJob>("web-push-news", {
  connection: redisConnection,
});

function buildJobId(job: WebPushNewsJob) {
  return `${job.newsId}-${job.subscriptionId}`;
}

export async function enqueueWebPushNewsJobs(jobs: WebPushNewsJob[]) {
  if (!jobs.length) return;

  await webPushQueue.addBulk(
    jobs.map((job) => ({
      name: "send-news-push",
      data: job,
      opts: {
        jobId: buildJobId(job),
        removeOnComplete: 5000,
        removeOnFail: 10000,
        attempts: 5,
        backoff: { type: "exponential", delay: 2000 },
      },
    }))
  );
}
