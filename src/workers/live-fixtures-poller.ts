import {
  apiFootballLiveClient,
  type ApiFootballLiveFixture,
} from "../features/notifications/infrastructure/api-football-live.client";
import { computeDiffTriggers, type StoredMatchState } from "../features/notifications/application/diff-engine";
import { redisConnection } from "../shared/redis/redis.connection";
import { minutoPrismaClient } from "../lib/minuto-client";
import { enqueueWhatsappNotificationsBulk } from "../features/notifications/whatsapp/notification.queue";
import { logError, logInfo, logWarn } from "../shared/logging/logger";
import { templates } from "../features/notifications/application/templates";
import { createHash } from "crypto";
import { buildMatchUrl } from "../features/notifications/application/match-url";
import {
  captureSubscriptionBaseline,
  getSubscriptionBaseline,
  type SubscriptionBaseline,
} from "../features/notifications/application/subscription-baseline";
import { updateLiveFixturesCache, invalidateStandingsCache, saveFixtureEvents } from "./live-cache-updater";
import { captureFixtureStatsPeriodSnapshot } from "./halftime-snapshot";
import { enqueueMatchNewsGeneration } from "../features/news/application/match-news.queue";
import { isFeaturedCompetitionId } from "../features/insights/infrastructure/featured-competition-priority";
import { areNotificationsEnabled } from "../shared/config/notifications";
import {
  canReceiveWhatsappNotifications,
  isLiveTriggerEnabled,
} from "../features/notifications/application/subscriber-preferences";
import { footballApiClient } from "../features/sports/infrastructure/football-api.client";
import {
  FT_DISAPPEARED_SKIP_STATUSES,
  MIN_ELAPSED_FOR_FT_DISAPPEARED,
  isLikelyHalftime,
  missingPollThresholdFor,
} from "./live-fixtures-poller.policy";
import { filterOutStaleLive } from "../features/sports/infrastructure/football-stale-live";

/** Por defecto 5s: notificaciones en vivo (p. ej. final) dependen del siguiente poll. Subir vía env si hay límite de API. */
const POLL_INTERVAL_MS = Number(process.env.LIVE_POLL_INTERVAL_MS ?? 5000);
const REDIS_TTL_SECONDS = 60 * 60 * 4;
const LIVE_SET_KEY = "live_fixtures:last";
const MISSING_PREFIX = "match_missing:";
const EVENT_LEDGER_PREFIX = "match_event:";
const DISAPPEARANCE_FALLBACK_MAX_AGE_MS = Number(process.env.LIVE_DISAPPEARANCE_FALLBACK_MAX_AGE_MS ?? 10 * 60 * 1000);
const terminalStatuses = new Set(["FT", "AET", "PEN"]);
const breakStatuses = new Set(["HT", "BT", "INT"]);

function stateKey(fixtureId: number) {
  return `match_state:${fixtureId}`;
}

function ledgerKey(fixtureId: number, eventKey: string) {
  const h = createHash("sha1").update(eventKey).digest("hex");
  return `${EVENT_LEDGER_PREFIX}${fixtureId}:${h}`;
}

function missingKey(fixtureId: number) {
  return `${MISSING_PREFIX}${fixtureId}`;
}

async function assertRedisReady() {
  try {
    await redisConnection.ping();
  } catch (err: any) {
    logError("redis.not_ready", { err: err?.message ?? String(err), redisUrl: process.env.REDIS_URL ?? "default" });
    throw err;
  }
}

async function getOldState(fixtureId: number): Promise<StoredMatchState | null> {
  const raw = await redisConnection.get(stateKey(fixtureId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredMatchState;
  } catch {
    return null;
  }
}

async function setNewState(fixtureId: number, state: StoredMatchState) {
  await redisConnection.set(stateKey(fixtureId), JSON.stringify(state), "EX", REDIS_TTL_SECONDS);
}

async function shouldEmitTrigger(fixtureId: number, eventKey: string): Promise<boolean> {
  const key = ledgerKey(fixtureId, eventKey);
  const res = await redisConnection.set(key, "1", "EX", REDIS_TTL_SECONDS, "NX");
  return res === "OK";
}

function isTerminalStatus(statusShort: string | null | undefined) {
  return terminalStatuses.has(statusShort ?? "");
}

function isHalftimeOrLater(statusShort: string | null | undefined) {
  return breakStatuses.has(statusShort ?? "") || statusShort === "2H" || isTerminalStatus(statusShort);
}

function isSecondHalfOrLater(statusShort: string | null | undefined) {
  return statusShort === "2H" || isTerminalStatus(statusShort);
}

function isBaselineTriggerAlreadyCovered(
  baseline: SubscriptionBaseline | null,
  trigger: ReturnType<typeof computeDiffTriggers>["triggers"][number],
  newState: StoredMatchState
) {
  if (!baseline) return false;

  switch (trigger.type) {
    case "KICKOFF":
      return baseline.statusShort !== null && baseline.statusShort !== "NS";
    case "GOAL":
      if (trigger.eventKey.startsWith("event:")) {
        return baseline.eventKeys.includes(trigger.eventKey.slice("event:".length));
      }
      return baseline.goalsHome === newState.goalsHome && baseline.goalsAway === newState.goalsAway;
    case "VAR_CANCELLED":
      if (trigger.eventKey.startsWith("event:")) {
        return baseline.eventKeys.includes(trigger.eventKey.slice("event:".length));
      }
      return baseline.goalsHome === newState.goalsHome && baseline.goalsAway === newState.goalsAway;
    case "RED_CARD":
      if (trigger.eventKey.startsWith("event:")) {
        return baseline.eventKeys.includes(trigger.eventKey.slice("event:".length));
      }
      return baseline.redCards === newState.redCards;
    case "PENALTY_SHOOTOUT_START":
      return baseline.statusShort === "P";
    case "PENALTY_SHOOTOUT_KICK":
      if (trigger.eventKey.startsWith("event:")) {
        return baseline.eventKeys.includes(trigger.eventKey.slice("event:".length));
      }
      return false;
    case "HALFTIME":
      return isHalftimeOrLater(baseline.statusShort);
    case "SECOND_HALF":
      return isSecondHalfOrLater(baseline.statusShort);
    case "FULL_TIME":
    case "FULL_TIME_DISAPPEARED":
      return isTerminalStatus(baseline.statusShort);
    default:
      return false;
  }
}

async function dispatchTriggers(input: {
  fixtureId: number;
  triggers: ReturnType<typeof computeDiffTriggers>["triggers"];
  newState: StoredMatchState;
}) {
  if (!areNotificationsEnabled()) return;
  if (!input.triggers.length) return;

  const subs = await minutoPrismaClient.matchSubscription.findMany({
    where: { fixtureId: input.fixtureId },
    include: { subscriber: true },
  });

  if (!subs.length) return;

  const subsBySubscriberId = new Map<string, (typeof subs)[number]>();
  for (const sub of subs) {
    if (!sub?.subscriber?.isActive) continue;
    if (!subsBySubscriberId.has(sub.subscriberId)) {
      subsBySubscriberId.set(sub.subscriberId, sub);
    }
  }
  if (!subsBySubscriberId.size) return;

  // Recuperación defensiva: si una subscription existe SIN baseline (p. ej. la captura
  // falló durante el upsert), capturarlo ahora y marcar al suscriptor como "recién unido".
  // Sin baseline no podemos diferenciar evento histórico vs nuevo: enviar todos los triggers
  // del poll actual spamearía 90 min de historial. Mejor skip los triggers de este poll
  // para ese suscriptor — desde el próximo poll ya operamos normal.
  const justRecoveredBaseline = new Set<string>();
  const baselineEntries = await Promise.all(
    Array.from(subsBySubscriberId.values()).map(async (sub) => {
      let baseline = await getSubscriptionBaseline(sub.subscriberId, input.fixtureId);
      if (!baseline) {
        try {
          baseline = await captureSubscriptionBaseline(sub.subscriberId, input.fixtureId);
          justRecoveredBaseline.add(sub.subscriberId);
          logWarn("whatsapp.dispatch.baseline_recovered", {
            fixtureId: input.fixtureId,
            subscriberId: sub.subscriberId,
            recoveredStatus: baseline?.statusShort ?? null,
            recoveredGoals: baseline ? `${baseline.goalsHome}-${baseline.goalsAway}` : null,
          });
        } catch (err: any) {
          logWarn("whatsapp.dispatch.baseline_recovery_failed", {
            fixtureId: input.fixtureId,
            subscriberId: sub.subscriberId,
            err: err?.message ?? String(err),
          });
          // baseline sigue null. Igual marcamos al suscriptor como recién recuperado para
          // skip — preferimos no notificar (riesgo de spam histórico) que arriesgar.
          justRecoveredBaseline.add(sub.subscriberId);
        }
      }
      return [sub.subscriberId, baseline] as const;
    })
  );
  const baselineBySubscriberId = new Map<string, SubscriptionBaseline | null>(baselineEntries);

  const jobs: Parameters<typeof enqueueWhatsappNotificationsBulk>[0] = [];
  let baselineSkipped = 0;
  let baselineRecoverySkipped = 0;
  let triggerDisabled = 0;
  let noPhone = 0;
  // El dedup por suscriptor (`match_msg:`) se aplica AHORA en el worker, después del send exitoso.
  // Anteriormente se seteaba antes del enqueue, lo que dejaba un fantasma de "ya enviado" si el
  // job fallaba permanentemente (Evolution API caído) → el gol se perdía silenciosamente para
  // ese suscriptor por 30 min. BullMQ ya dedupea por jobId mientras el job vive en la cola.
  for (const trigger of input.triggers) {
    for (const sub of subsBySubscriberId.values()) {
      if (justRecoveredBaseline.has(sub.subscriberId)) {
        // Baseline recién recuperado en este poll: no podemos distinguir triggers
        // históricos de nuevos. Skip este poll; el próximo opera normal.
        baselineRecoverySkipped++;
        if (process.env.NOTIFICATIONS_DEBUG === "true") {
          logInfo("whatsapp.dispatch.baseline_recovery_skip", {
            fixtureId: input.fixtureId,
            triggerType: trigger.type,
            subscriberId: sub.subscriberId,
          });
        }
        continue;
      }
      if (!isLiveTriggerEnabled(sub.subscriber, trigger.type)) {
        triggerDisabled++;
        if (process.env.NOTIFICATIONS_DEBUG === "true") {
          logInfo("whatsapp.dispatch.trigger_disabled", {
            fixtureId: input.fixtureId,
            triggerType: trigger.type,
            subscriberId: sub.subscriberId,
          });
        }
        continue;
      }
      const baseline = baselineBySubscriberId.get(sub.subscriberId) ?? null;
      if (isBaselineTriggerAlreadyCovered(baseline, trigger, input.newState)) {
        baselineSkipped++;
        if (process.env.NOTIFICATIONS_DEBUG === "true") {
          logInfo("whatsapp.dispatch.baseline_skip", {
            fixtureId: input.fixtureId,
            triggerType: trigger.type,
            eventKey: trigger.eventKey,
            subscriberId: sub.subscriberId,
            baselineStatus: baseline?.statusShort ?? null,
            baselineGoals: baseline ? `${baseline.goalsHome}-${baseline.goalsAway}` : null,
            newGoals: `${input.newState.goalsHome}-${input.newState.goalsAway}`,
          });
        }
        continue;
      }
      if (!canReceiveWhatsappNotifications(sub.subscriber)) {
        noPhone++;
        if (process.env.NOTIFICATIONS_DEBUG === "true") {
          logInfo("whatsapp.dispatch.no_phone", {
            fixtureId: input.fixtureId,
            triggerType: trigger.type,
            subscriberId: sub.subscriberId,
          });
        }
        continue;
      }

      jobs.push({
        phone: sub.subscriber.phoneNumber,
        message: trigger.message,
        fixtureId: input.fixtureId,
        triggerType: trigger.type,
        subscriberId: sub.subscriberId,
        eventKey: trigger.eventKey,
        scoreHome: trigger.scoreHome,
        scoreAway: trigger.scoreAway,
      });
    }
  }

  await enqueueWhatsappNotificationsBulk(jobs);

  if (process.env.NOTIFICATIONS_DEBUG === "true") {
    logInfo("whatsapp.notifications.enqueued", {
      fixtureId: input.fixtureId,
      triggers: input.triggers.length,
      baselineSkipped,
      baselineRecoverySkipped,
      triggerDisabled,
      noPhone,
      subs: subs.length,
      activeSubscribers: subsBySubscriberId.size,
      jobs: jobs.length,
    });
  }
}

async function processOneFixture(fixture: ApiFootballLiveFixture) {
  const fixtureId = fixture.fixture.id;
  await redisConnection.del(missingKey(fixtureId));

  const oldState = await getOldState(fixtureId);
  const { triggers, newState, hasRelevantChanges } = computeDiffTriggers(oldState, fixture);

  if (process.env.NOTIFICATIONS_DEBUG === "true" && triggers.length) {
    logInfo("live.triggers.detected", {
      fixtureId,
      triggers: triggers.map((t) => t.type),
      triggersCount: triggers.length,
      hasRelevantChanges,
      hadOldState: Boolean(oldState),
    });
  }

  if (triggers.length) {
    await dispatchTriggers({ fixtureId, triggers, newState });

    const hasFullTime = triggers.some((t) => t.type === "FULL_TIME");
    if (hasFullTime) {
      const leagueId = fixture.league?.id;
      const homeTeamId = fixture.teams?.home?.id;
      const awayTeamId = fixture.teams?.away?.id;
      const homeGoals = fixture.goals?.home ?? 0;
      const awayGoals = fixture.goals?.away ?? 0;
      const season = fixture.league?.season ?? CURRENT_SEASON;

      if (typeof leagueId === "number") {
        invalidateStandingsCache(leagueId, season).catch(() => {});
      }

      // Crónica post-partido por IA (solo competiciones destacadas; no-op si el flag está off).
      if (typeof leagueId === "number" && isFeaturedCompetitionId(leagueId)) {
        enqueueMatchNewsGeneration({ fixtureId, leagueId, season }).catch(() => {});
      }
    }
  }

  await captureFixtureStatsPeriodSnapshot({
    fixtureId,
    statusShort: fixture.fixture.status?.short ?? null,
    elapsed: fixture.fixture.status?.elapsed ?? null,
  });

  // Persist events so they survive beyond the short live-snapshot TTL and remain
  // available for finished matches in the home feed (red cards, goals, etc.).
  if (Array.isArray(fixture.events) && fixture.events.length > 0) {
    saveFixtureEvents(fixtureId, fixture.events).catch(() => {});
  }

  // Always persist state so updatedAtMs stays fresh (≤ POLL_INTERVAL_MS old).
  // The clock anchor on the client interpolates elapsed from updatedAtMs — a stale
  // timestamp causes the displayed minute to drift away from reality.
  await setNewState(fixtureId, newState);
}

async function getLastLiveSet(): Promise<number[]> {
  const raw = await redisConnection.get(LIVE_SET_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "number") : [];
  } catch {
    return [];
  }
}

async function setLastLiveSet(ids: number[]) {
  await redisConnection.set(LIVE_SET_KEY, JSON.stringify(ids), "EX", REDIS_TTL_SECONDS);
}

async function listRecentlyTrackedFixtureIds(): Promise<number[]> {
  const ids: number[] = [];
  let cursor = "0";
  const max = 5000;

  while (true) {
    const [next, keys] = (await redisConnection.scan(cursor, "MATCH", "match_state:*", "COUNT", "500")) as unknown as [
      string,
      string[],
    ];
    cursor = next;

    for (const k of keys) {
      const m = /^match_state:(\d+)$/.exec(k);
      if (!m) continue;
      ids.push(Number(m[1]));
      if (ids.length >= max) return ids;
    }

    if (cursor === "0") break;
  }

  return ids;
}

async function handleDisappearances(currentIds: number[]) {
  const lastIds = await getLastLiveSet();
  const current = new Set(currentIds);

  // Fallback on cold start/restart: if we have tracked match_state keys but no last live set,
  // use them as a baseline to still detect disappearances.
  const baselineIds = lastIds.length ? lastIds : await listRecentlyTrackedFixtureIds();

  const missing = baselineIds.filter((id) => !current.has(id));
  if (!missing.length) {
    await setLastLiveSet(currentIds);
    return;
  }

  const stillPending: number[] = [];

  for (const fixtureId of missing) {
    try {
      const missKey = missingKey(fixtureId);
      const missingCount = await redisConnection.incr(missKey);
      await redisConnection.expire(missKey, REDIS_TTL_SECONDS);

      const oldState = await getOldState(fixtureId);
      if (!oldState) continue;
      const ageMs = Date.now() - (oldState.updatedAtMs ?? 0);
      if (!lastIds.length && ageMs > DISAPPEARANCE_FALLBACK_MAX_AGE_MS) continue;

      const s = oldState.statusShort ?? "";
      if (FT_DISAPPEARED_SKIP_STATUSES.has(s)) continue;

      const fixture = oldState.fixture;
      const elapsed = fixture.fixture.status?.elapsed ?? null;

      // Guarda absoluta: nunca disparar FT por desaparición si el partido está en primer tiempo
      // o early-second-half. El proveedor a veces saca fixtures temporalmente del listado live.
      if (typeof elapsed === "number" && elapsed < MIN_ELAPSED_FOR_FT_DISAPPEARED) {
        stillPending.push(fixtureId);
        continue;
      }

      const threshold = missingPollThresholdFor(s, elapsed);
      if (missingCount < threshold) {
        stillPending.push(fixtureId);
        continue;
      }

      if (isLikelyHalftime(s, elapsed)) continue;

      const homeTeam = fixture.teams?.home?.name ?? "Home";
      const awayTeam = fixture.teams?.away?.name ?? "Away";
      const leagueName = fixture.league?.name ?? "League";
      const scoreHome = oldState.goalsHome ?? 0;
      const scoreAway = oldState.goalsAway ?? 0;
      const matchUrl = buildMatchUrl({ fixtureId, leagueName, homeTeam, awayTeam });

      const ok = await shouldEmitTrigger(fixtureId, `FULL_TIME_DISAPPEARED:disappeared`);
      if (!ok) continue;

      await captureFixtureStatsPeriodSnapshot({
        fixtureId,
        statusShort: "FT",
        elapsed: elapsed ?? 90,
      });

      const subs = await minutoPrismaClient.matchSubscription.findMany({
        where: { fixtureId },
        include: { subscriber: true },
      });
      if (!subs.length) continue;

      const message = templates.fullTime({ homeTeam, awayTeam, leagueName, scoreHome, scoreAway, matchUrl });
      const jobs: Parameters<typeof enqueueWhatsappNotificationsBulk>[0] = [];
      for (const sub of subs) {
        if (
          !canReceiveWhatsappNotifications(sub.subscriber) ||
          !isLiveTriggerEnabled(sub.subscriber, "FULL_TIME")
        ) {
          continue;
        }
        const phone = sub.subscriber.phoneNumber;
        if (!phone) continue;
        // Dedup per-subscriber se hace en el worker (post-send). El `shouldEmitTrigger` global
        // de arriba (línea ~390) ya garantiza que FT_DISAPPEARED se emite una sola vez por fixture.
        jobs.push({
          phone,
          message,
          fixtureId,
          triggerType: "FULL_TIME",
          subscriberId: sub.subscriberId,
          eventKey: "disappeared",
        });
      }

      await enqueueWhatsappNotificationsBulk(jobs);

      const leagueId = fixture.league?.id;
      const homeTeamId = fixture.teams?.home?.id;
      const awayTeamId = fixture.teams?.away?.id;
      const season = fixture.league?.season ?? CURRENT_SEASON;
      if (typeof leagueId === "number") {
        invalidateStandingsCache(leagueId, season).catch(() => {});
      }

      // Crónica post-partido por IA también para partidos que finalizan al desaparecer del live.
      if (typeof leagueId === "number" && isFeaturedCompetitionId(leagueId)) {
        enqueueMatchNewsGeneration({ fixtureId, leagueId, season }).catch(() => {});
      }

      logInfo("live.disappeared.full_time.enqueued", {
        fixtureId,
        subs: jobs.length,
        lastStatus: s,
        lastElapsed: elapsed,
        missingCount,
      });
    } catch (err: any) {
      logWarn("live.disappeared.full_time.failed", { fixtureId, err: err?.message ?? String(err) });
    }
  }

  // Persist current IDs + still-pending disappeared fixtures so they remain
  // in the baseline for future polls until their missing counter reaches threshold.
  await setLastLiveSet([...currentIds, ...stillPending]);
}

const CURRENT_SEASON = new Date().getFullYear() - 1;
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;
const UPCOMING_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const UPCOMING_WINDOW_MS = 20 * 60 * 1000; // fixtures starting in next 20 minutes

async function logHeartbeat(liveCount: number) {
  const liveIds = await getLastLiveSet();
  logInfo("live.heartbeat", {
    liveFixtures: liveIds.length,
    lastPollLive: liveCount,
    pollIntervalMs: POLL_INTERVAL_MS,
    uptimeSeconds: Math.round(process.uptime()),
  });
}

async function checkUpcomingFixtures() {
  const now = Date.now();
  const today = new Date().toISOString().split("T")[0];
  try {
    const envelope = await footballApiClient.getFixtures({ date: today, timezone: "UTC" });
    const fixtures = envelope.response ?? [];

    const upcoming = fixtures.filter((fx) => {
      const ts = fx.fixture?.timestamp;
      if (!ts) return false;
      const ms = ts * 1000;
      return ms > now && ms <= now + UPCOMING_WINDOW_MS;
    });

    if (upcoming.length > 0) {
      logInfo("live.upcoming.fixtures", {
        count: upcoming.length,
        fixtures: upcoming.map((fx) => ({
          id: fx.fixture.id,
          home: fx.teams?.home?.name,
          away: fx.teams?.away?.name,
          startsInMin: Math.round(((fx.fixture.timestamp ?? 0) * 1000 - now) / 60000),
        })),
      });
    } else {
      logInfo("live.upcoming.none", { windowMinutes: UPCOMING_WINDOW_MS / 60000 });
    }
  } catch (err: any) {
    logWarn("live.upcoming.check_failed", { err: err?.message ?? String(err) });
  }
}

async function pollOnce() {
  const startedAt = Date.now();
  const { fixtures: rawFixtures, envelope: rawEnvelope } =
    await apiFootballLiveClient.listLiveFixturesWithEnvelope();

  // Guard de "live rancio": API-Football a veces deja un fixture clavado en estado en juego
  // (p. ej. 1H minuto 28) y lo sigue publicando en /fixtures?live=all horas después del kickoff.
  // Lo sacamos del set en vivo para que no contamine snapshot, live=all, reloj ni notificaciones.
  const fixtures = filterOutStaleLive(rawFixtures);
  const staleDropped = rawFixtures.length - fixtures.length;
  const envelope =
    staleDropped > 0 ? { ...(rawEnvelope as object), response: fixtures } : rawEnvelope;
  if (staleDropped > 0) {
    logInfo("live.stale_live.dropped", {
      dropped: staleDropped,
      ids: rawFixtures
        .filter((f) => !fixtures.includes(f))
        .map((f) => f?.fixture?.id),
    });
  }

  await updateLiveFixturesCache(envelope);

  const ids = fixtures.map((f) => f.fixture.id).filter((id) => typeof id === "number");
  await handleDisappearances(ids);

  const concurrency = Number(process.env.LIVE_POLL_CONCURRENCY ?? 10);
  let i = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (i < fixtures.length) {
      const idx = i++;
      const f = fixtures[idx];
      try {
        await processOneFixture(f);
      } catch (err: any) {
        logWarn("live.fixture.processing_failed", { fixtureId: f?.fixture?.id, err: err?.message ?? String(err) });
      }
    }
  });

  await Promise.all(workers);

  logInfo("live.poll.ok", {
    fixtures: fixtures.length,
    tookMs: Date.now() - startedAt,
  });
}

async function main() {
  await assertRedisReady();
  logInfo("live.poller.started", {
    intervalMs: POLL_INTERVAL_MS,
    heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
    upcomingCheckIntervalMs: UPCOMING_CHECK_INTERVAL_MS,
    upcomingWindowMs: UPCOMING_WINDOW_MS,
  });

  let running = false;
  let lastLiveCount = 0;
  const loop = async () => {
    if (running) return;
    running = true;
    try {
      await pollOnce();
      const ids = await getLastLiveSet();
      lastLiveCount = ids.length;
    } catch (err: any) {
      logError("live.poll.failed", { err: err?.message ?? String(err) });
    } finally {
      running = false;
    }
  };

  await loop();
  setInterval(loop, POLL_INTERVAL_MS);

  // Heartbeat log every 5 minutes
  setInterval(() => {
    logHeartbeat(lastLiveCount).catch((err: any) =>
      logWarn("live.heartbeat.failed", { err: err?.message ?? String(err) })
    );
  }, HEARTBEAT_INTERVAL_MS);

  // Check upcoming fixtures every 5 minutes
  checkUpcomingFixtures().catch(() => {});
  setInterval(() => {
    checkUpcomingFixtures().catch((err: any) =>
      logWarn("live.upcoming.interval_failed", { err: err?.message ?? String(err) })
    );
  }, UPCOMING_CHECK_INTERVAL_MS);
}

main().catch((e) => {
  logError("live.poller.fatal", { err: e?.message ?? String(e) });
  process.exitCode = 1;
});
