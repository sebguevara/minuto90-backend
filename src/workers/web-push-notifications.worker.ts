import { Worker } from "bullmq";
import { minutoPrismaClient } from "../lib/minuto-client";
import { sendWebPushNotification } from "../features/push/infrastructure/web-push.client";
import type { WebPushNewsJob } from "../features/push/push.queue";
import { redisConnection } from "../shared/redis/redis.connection";
import { logError, logInfo } from "../shared/logging/logger";

const worker = new Worker<WebPushNewsJob>(
  "web-push-news",
  async (job) => {
    const subscription = await minutoPrismaClient.pushSubscription.findUnique({
      where: { id: job.data.subscriptionId },
    });

    if (!subscription) {
      return;
    }

    try {
      await sendWebPushNotification({
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        payload: job.data.payload,
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
  },
  {
    connection: redisConnection,
    concurrency: Number(process.env.WEB_PUSH_WORKER_CONCURRENCY ?? 20),
  }
);

worker.on("failed", (job, err) => {
  logError("push.send.failed", {
    jobId: job?.id,
    newsId: job?.data?.newsId,
    subscriptionId: job?.data?.subscriptionId,
    err: err?.message ?? String(err),
  });
});

worker.on("completed", (job) => {
  if (process.env.NOTIFICATIONS_DEBUG === "true") {
    logInfo("push.job.completed", {
      jobId: job.id,
      newsId: job.data.newsId,
      subscriptionId: job.data.subscriptionId,
    });
  }
});

logInfo("push.worker.started");
