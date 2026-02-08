import { Queue } from "bullmq";
import { redisConnection } from "../../../shared/redis/redis.connection";
import { createHash } from "crypto";
import { logInfo } from "../../../shared/logging/logger";

export type WhatsappNotificationJob = {
  phone: string;
  message: string;
  fixtureId: number;
  triggerType: string;
  subscriberId: string;
  eventKey: string;
};

export const notificationQueue = new Queue<WhatsappNotificationJob>("whatsapp-notifications", {
  connection: redisConnection,
});

function hashEventKey(eventKey: string) {
  return createHash("sha1").update(eventKey).digest("hex");
}

function buildJobId(job: WhatsappNotificationJob) {
  const hashedEventKey = hashEventKey(job.eventKey);
  return `${job.fixtureId}-${job.triggerType}-${job.subscriberId}-${hashedEventKey}`;
}

export async function enqueueWhatsappNotification(job: WhatsappNotificationJob) {
  const jobId = buildJobId(job);
  await notificationQueue.add("send", job, {
    jobId,
    removeOnComplete: 5000,
    removeOnFail: 10000,
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
  });

  if (process.env.NOTIFICATIONS_DEBUG === "true") {
    logInfo("whatsapp.notification.enqueued", {
      jobId,
      fixtureId: job.fixtureId,
      triggerType: job.triggerType,
      subscriberId: job.subscriberId,
      phone: job.phone,
    });
  }
}

export async function enqueueWhatsappNotificationsBulk(jobs: WhatsappNotificationJob[]) {
  if (!jobs.length) return;
  await notificationQueue.addBulk(
    jobs.map((job) => {
      const jobId = buildJobId(job);
      return {
        name: "send",
        data: job,
        opts: {
          jobId,
          removeOnComplete: 5000,
          removeOnFail: 10000,
          attempts: 5,
          backoff: { type: "exponential", delay: 2000 },
        },
      };
    })
  );

  if (process.env.NOTIFICATIONS_DEBUG === "true") {
    logInfo("whatsapp.notifications.enqueued.bulk", { jobs: jobs.length });
  }
}
