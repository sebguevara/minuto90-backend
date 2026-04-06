import { Queue } from "bullmq";
import { redisConnection } from "../../shared/redis/redis.connection";
import { areNotificationsEnabled } from "../../shared/config/notifications";

export type WebPushNewsJob = {
  newsId: string;
  subscriptionId: string;
  payload: string;
};

export type WebPushMatchJob = {
  fixtureId: number;
  subscriptionId: string;
  payload: string;
};

export type WebPushCustomJob = {
  customId: string;
  subscriptionId: string;
  payload: string;
};

export const webPushQueue = new Queue<WebPushNewsJob>("web-push-news", {
  connection: redisConnection,
});

export const webPushMatchQueue = new Queue<WebPushMatchJob>("web-push-match", {
  connection: redisConnection,
});

export const webPushCustomQueue = new Queue<WebPushCustomJob>("web-push-custom", {
  connection: redisConnection,
});

function buildJobId(job: WebPushNewsJob) {
  return `${job.newsId}-${job.subscriptionId}`;
}

function buildMatchJobId(job: WebPushMatchJob) {
  return `match-${job.fixtureId}-${job.subscriptionId}`;
}

function buildCustomJobId(job: WebPushCustomJob) {
  return `custom-${job.customId}-${job.subscriptionId}`;
}

export async function enqueueWebPushNewsJobs(jobs: WebPushNewsJob[]) {
  if (!areNotificationsEnabled()) return;
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

export async function enqueueWebPushMatchJobs(jobs: WebPushMatchJob[]) {
  if (!areNotificationsEnabled()) return;
  if (!jobs.length) return;

  await webPushMatchQueue.addBulk(
    jobs.map((job) => ({
      name: "send-match-push",
      data: job,
      opts: {
        jobId: buildMatchJobId(job),
        removeOnComplete: 5000,
        removeOnFail: 10000,
        attempts: 5,
        backoff: { type: "exponential", delay: 2000 },
      },
    }))
  );
}

export async function enqueueWebPushCustomJobs(jobs: WebPushCustomJob[]) {
  if (!areNotificationsEnabled()) return;
  if (!jobs.length) return;

  await webPushCustomQueue.addBulk(
    jobs.map((job) => ({
      name: "send-custom-push",
      data: job,
      opts: {
        jobId: buildCustomJobId(job),
        removeOnComplete: 5000,
        removeOnFail: 10000,
        attempts: 5,
        backoff: { type: "exponential", delay: 2000 },
      },
    }))
  );
}
