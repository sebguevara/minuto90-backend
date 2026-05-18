import { Worker } from "bullmq";
import { createHash } from "crypto";
import { redisConnection } from "../shared/redis/redis.connection";
import {
  evolutionApiClient,
  getActiveEvolutionInstances,
  type EvolutionInstanceConfig,
} from "../features/notifications/infrastructure/evolution-api.client";
import { selectEvolutionInstance } from "../features/notifications/infrastructure/evolution-instance.selector";
import type { WhatsappNotificationJob } from "../features/notifications/whatsapp/notification.queue";
import { areNotificationsEnabled } from "../shared/config/notifications";
import { logError, logInfo } from "../shared/logging/logger";

const WHATSAPP_SEND_DEDUPE_TTL_SECONDS = Number(
  process.env.WHATSAPP_SEND_DEDUPE_TTL_SECONDS ?? 180
);
/** TTL del marcador "ya entregado" por suscriptor. Se setea recién después del send exitoso.
 *  Antes se seteaba en el poller ANTES del enqueue, lo que dejaba un fantasma de "enviado"
 *  cuando el worker fallaba permanentemente → el gol se perdía silenciosamente. */
const MATCH_MSG_DELIVERED_TTL_SECONDS = Number(
  process.env.LIVE_MESSAGE_DEDUP_TTL_SECONDS ?? 1800
);

function normalizePhoneForDedupe(phone: string) {
  return String(phone ?? "").replace(/\D/g, "");
}

function deliveredKey(subscriberId: string, fixtureId: number, triggerType: string, eventKey: string) {
  const h = createHash("sha1").update(eventKey).digest("hex");
  return `match_msg:${subscriberId}:${fixtureId}:${triggerType}:${h}`;
}

async function isAlreadyDelivered(
  subscriberId: string,
  fixtureId: number,
  triggerType: string,
  eventKey: string
): Promise<boolean> {
  const key = deliveredKey(subscriberId, fixtureId, triggerType, eventKey);
  return (await redisConnection.get(key)) !== null;
}

async function markDelivered(
  subscriberId: string,
  fixtureId: number,
  triggerType: string,
  eventKey: string
) {
  const key = deliveredKey(subscriberId, fixtureId, triggerType, eventKey);
  await redisConnection.set(key, "1", "EX", MATCH_MSG_DELIVERED_TTL_SECONDS);
}

function whatsappSendDedupeKey(phone: string, fixtureId: number, triggerType: string, eventKey: string) {
  const norm = normalizePhoneForDedupe(phone);
  const h = createHash("sha1")
    .update(`${norm}|${fixtureId}|${triggerType}|${eventKey}`)
    .digest("hex");
  return `wa:send:dedupe:${h}`;
}

async function tryClaimWhatsappSend(
  phone: string,
  fixtureId: number,
  triggerType: string,
  eventKey: string
): Promise<boolean> {
  const key = whatsappSendDedupeKey(phone, fixtureId, triggerType, eventKey);
  const res = await redisConnection.set(key, "1", "EX", WHATSAPP_SEND_DEDUPE_TTL_SECONDS, "NX");
  return res === "OK";
}

async function releaseWhatsappSendClaim(phone: string, fixtureId: number, triggerType: string, eventKey: string) {
  const key = whatsappSendDedupeKey(phone, fixtureId, triggerType, eventKey);
  await redisConnection.del(key);
}

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

/** Returns true when a GOAL notification should be skipped because the score it
 *  reports has already been corrected downward (e.g. via VAR) before delivery. */
async function isGoalScoreStale(
  fixtureId: number,
  scoreHome: number | undefined,
  scoreAway: number | undefined
): Promise<boolean> {
  if (scoreHome === undefined || scoreAway === undefined) return false;
  try {
    const raw = await redisConnection.get(`match_state:${fixtureId}`);
    if (!raw) return false;
    const state = JSON.parse(raw) as { goalsHome?: number; goalsAway?: number };
    const currentHome = typeof state.goalsHome === "number" ? state.goalsHome : scoreHome;
    const currentAway = typeof state.goalsAway === "number" ? state.goalsAway : scoreAway;
    return currentHome < scoreHome || currentAway < scoreAway;
  } catch {
    return false;
  }
}

const worker = new Worker<WhatsappNotificationJob>(
  "whatsapp-notifications",
  async (job) => {
    if (!areNotificationsEnabled()) return;

    const { phone, message, fixtureId, triggerType, subscriberId, eventKey, scoreHome, scoreAway } = job.data;
    if (process.env.NOTIFICATIONS_DEBUG === "true") {
      logInfo("whatsapp.send.due", {
        jobId: job.id,
        fixtureId,
        triggerType,
        subscriberId,
        phone,
        eventKey,
        messageLen: message.length,
        messageSha1: createHash("sha1").update(message).digest("hex"),
        attemptsMade: job.attemptsMade,
      });
    }

    // Skip stale GOAL notifications when the score was corrected downward before delivery (e.g. VAR).
    if (triggerType === "GOAL") {
      const stale = await isGoalScoreStale(fixtureId, scoreHome, scoreAway);
      if (stale) {
        if (process.env.NOTIFICATIONS_DEBUG === "true") {
          logInfo("whatsapp.send.skipped_stale_goal", {
            jobId: job.id,
            fixtureId,
            triggerType,
            subscriberId,
            scoreHome,
            scoreAway,
          });
        }
        return;
      }
    }

    // Si ya entregamos exitosamente esta combinación (fixture+trigger+subscriber+eventKey)
    // en los últimos 30 min, no reenviar. Esto cubre re-enqueues después de removeOnComplete.
    if (await isAlreadyDelivered(subscriberId, fixtureId, triggerType, eventKey)) {
      if (process.env.NOTIFICATIONS_DEBUG === "true") {
        logInfo("whatsapp.send.already_delivered", {
          jobId: job.id,
          fixtureId,
          triggerType,
          subscriberId,
        });
      }
      return;
    }

    const claimed = await tryClaimWhatsappSend(phone, fixtureId, triggerType, eventKey);
    if (!claimed) {
      if (process.env.NOTIFICATIONS_DEBUG === "true") {
        logInfo("whatsapp.send.skipped_duplicate", {
          jobId: job.id,
          fixtureId,
          triggerType,
          subscriberId,
        });
      }
      return;
    }

    const instances = await getInstancesCached();
    const instance = await selectEvolutionInstance(instances);
    try {
      await evolutionApiClient.sendText({ number: phone, text: message, instance });
    } catch (sendErr) {
      await releaseWhatsappSendClaim(phone, fixtureId, triggerType, eventKey);
      throw sendErr;
    }

    // Marcar como entregado SÓLO tras send exitoso. Si falla, BullMQ reintenta;
    // si todos los intentos fallan, no queda fantasma de "ya enviado" en Redis.
    await markDelivered(subscriberId, fixtureId, triggerType, eventKey);

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
    eventKey: job?.data?.eventKey,
    attemptsMade,
    attempts,
    willRetry,
    err: err?.message ?? String(err),
  });

  // Fallo permanente: trigger perdido para este suscriptor. Loguear con eventKey para poder
  // diagnosticar (o reenviar manualmente). Sin esta señal, el gol/aviso se pierde silenciosamente.
  if (willRetry === false) {
    logError("whatsapp.send.permanently_failed", {
      jobId: job?.id,
      fixtureId: job?.data?.fixtureId,
      triggerType: job?.data?.triggerType,
      subscriberId: job?.data?.subscriberId,
      phone: job?.data?.phone,
      eventKey: job?.data?.eventKey,
      attemptsMade,
      err: err?.message ?? String(err),
    });
  }
});

worker.on("completed", (job) => {
  if (process.env.NOTIFICATIONS_DEBUG === "true") {
    logInfo("whatsapp.job.completed", { jobId: job.id });
  }
});

logInfo("whatsapp.worker.started");
