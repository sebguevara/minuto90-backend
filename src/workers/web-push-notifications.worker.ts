import { Worker } from "bullmq";
import { minutoPrismaClient } from "../lib/minuto-client";
import { sendWebPushNotification } from "../features/push/infrastructure/web-push.client";
import type { WebPushMatchJob, WebPushNewsJob, WebPushCustomJob } from "../features/push/push.queue";
import { redisConnection } from "../shared/redis/redis.connection";
import { areNotificationsEnabled } from "../shared/config/notifications";
import { logError, logInfo } from "../shared/logging/logger";

const CONCURRENCY = Number(process.env.WEB_PUSH_WORKER_CONCURRENCY ?? 20);

async function sendPushToSubscription(subscriptionId: string, payload: string) {
  if (!areNotificationsEnabled()) return;

  const subscription = await minutoPrismaClient.pushSubscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) return;

  try {
    await sendWebPushNotification({
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
      payload,
    });
  } catch (err: any) {
    const statusCode = Number(err?.statusCode ?? err?.status ?? 0);
    if (statusCode === 404 || statusCode === 410) {
      await minutoPrismaClient.pushSubscription.deleteMany({
        where: { endpoint: subscription.endpoint },
      });
      logInfo("push.subscription.invalidated", {
        subscriptionId: subscription.id,
        statusCode,
      });
      return;
    }
    throw err;
  }
}

// ─── News push worker ─────────────────────────────────────────────────────────

const newsWorker = new Worker<WebPushNewsJob>(
  "web-push-news",
  async (job) => sendPushToSubscription(job.data.subscriptionId, job.data.payload),
  { connection: redisConnection, concurrency: CONCURRENCY }
);

newsWorker.on("failed", (job, err) => {
  logError("push.news.send.failed", {
    jobId: job?.id,
    newsId: job?.data?.newsId,
    subscriptionId: job?.data?.subscriptionId,
    err: err?.message ?? String(err),
  });
});

newsWorker.on("completed", (job) => {
  if (process.env.NOTIFICATIONS_DEBUG === "true") {
    logInfo("push.news.job.completed", {
      jobId: job.id,
      newsId: job.data.newsId,
      subscriptionId: job.data.subscriptionId,
    });
  }
});

// ─── Match kickoff push worker ────────────────────────────────────────────────

const matchWorker = new Worker<WebPushMatchJob>(
  "web-push-match",
  async (job) => sendPushToSubscription(job.data.subscriptionId, job.data.payload),
  { connection: redisConnection, concurrency: CONCURRENCY }
);

matchWorker.on("failed", (job, err) => {
  logError("push.match.send.failed", {
    jobId: job?.id,
    fixtureId: job?.data?.fixtureId,
    subscriptionId: job?.data?.subscriptionId,
    err: err?.message ?? String(err),
  });
});

matchWorker.on("completed", (job) => {
  if (process.env.NOTIFICATIONS_DEBUG === "true") {
    logInfo("push.match.job.completed", {
      jobId: job.id,
      fixtureId: job.data.fixtureId,
      subscriptionId: job.data.subscriptionId,
    });
  }
});

// ─── Custom push worker ───────────────────────────────────────────────────────

const customWorker = new Worker<WebPushCustomJob>(
  "web-push-custom",
  async (job) => sendPushToSubscription(job.data.subscriptionId, job.data.payload),
  { connection: redisConnection, concurrency: CONCURRENCY }
);

customWorker.on("failed", (job, err) => {
  logError("push.custom.send.failed", {
    jobId: job?.id,
    customId: job?.data?.customId,
    subscriptionId: job?.data?.subscriptionId,
    err: err?.message ?? String(err),
  });
});

customWorker.on("completed", (job) => {
  if (process.env.NOTIFICATIONS_DEBUG === "true") {
    logInfo("push.custom.job.completed", {
      jobId: job.id,
      customId: job.data.customId,
      subscriptionId: job.data.subscriptionId,
    });
  }
});

logInfo("push.worker.started");
