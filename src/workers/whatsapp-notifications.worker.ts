import { Worker } from "bullmq";
import { redisConnection } from "../shared/redis/redis.connection";
import {
  evolutionApiClient,
  getActiveEvolutionInstances,
  type EvolutionInstanceConfig,
} from "../features/notifications/infrastructure/evolution-api.client";
import { selectEvolutionInstance } from "../features/notifications/infrastructure/evolution-instance.selector";
import type { WhatsappNotificationJob } from "../features/notifications/whatsapp/notification.queue";
import { logError, logInfo } from "../shared/logging/logger";
import { createHash } from "crypto";

let instancesCache: EvolutionInstanceConfig[] = [];
let instancesCacheAtMs = 0;
const INSTANCES_CACHE_TTL_MS = Number(process.env.EVOLUTION_INSTANCES_CACHE_TTL_MS ?? 10_000);

async function getInstancesCached(): Promise<EvolutionInstanceConfig[]> {
  const now = Date.now();
  if (instancesCache.length && now - instancesCacheAtMs < INSTANCES_CACHE_TTL_MS) return instancesCache;
  const list = await getActiveEvolutionInstances();
  instancesCache = list;
  instancesCacheAtMs = now;
  return list;
}

const worker = new Worker<WhatsappNotificationJob>(
  "whatsapp-notifications",
  async (job) => {
    const { phone, message, fixtureId, triggerType, subscriberId } = job.data;
    if (process.env.NOTIFICATIONS_DEBUG === "true") {
      logInfo("whatsapp.send.due", {
        jobId: job.id,
        fixtureId,
        triggerType,
        subscriberId,
        phone,
        messageLen: message.length,
        messageSha1: createHash("sha1").update(message).digest("hex"),
        attemptsMade: job.attemptsMade,
      });
    }

    const instances = await getInstancesCached();
    const instance = await selectEvolutionInstance(instances);
    await evolutionApiClient.sendText({ number: phone, text: message, instance });

    if (process.env.NOTIFICATIONS_DEBUG === "true") {
      logInfo("whatsapp.send.ok", {
        jobId: job.id,
        fixtureId,
        triggerType,
        subscriberId,
        instanceName: instance.instanceName,
      });
    }
  },
  {
    connection: redisConnection,
    concurrency: Number(process.env.WHATSAPP_WORKER_CONCURRENCY ?? 10),
    limiter: {
      max: Number(process.env.WHATSAPP_RATE_MAX ?? 5),
      duration: Number(process.env.WHATSAPP_RATE_DURATION_MS ?? 1000),
    },
  }
);

worker.on("failed", (job, err) => {
  const attempts = job?.opts?.attempts;
  const attemptsMade = job?.attemptsMade;
  const willRetry =
    typeof attempts === "number" && typeof attemptsMade === "number" ? attemptsMade + 1 < attempts : undefined;

  logError("whatsapp.send.failed", {
    jobId: job?.id,
    fixtureId: job?.data?.fixtureId,
    triggerType: job?.data?.triggerType,
    subscriberId: job?.data?.subscriberId,
    phone: job?.data?.phone,
    attemptsMade,
    attempts,
    willRetry,
    err: err?.message ?? String(err),
  });
});

worker.on("completed", (job) => {
  if (process.env.NOTIFICATIONS_DEBUG === "true") {
    logInfo("whatsapp.job.completed", { jobId: job.id });
  }
});

logInfo("whatsapp.worker.started");
