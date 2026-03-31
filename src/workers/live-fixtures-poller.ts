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
import { updateLiveFixturesCache, invalidateStandingsCache } from "./live-cache-updater";

const POLL_INTERVAL_MS = Number(process.env.LIVE_POLL_INTERVAL_MS ?? 20000);
const REDIS_TTL_SECONDS = 60 * 60 * 4;
const LIVE_SET_KEY = "live_fixtures:last";
const EVENT_LEDGER_PREFIX = "match_event:";
const MISSING_PREFIX = "match_missing:";
const MISSING_POLLS_BEFORE_FULL_TIME = Number(process.env.LIVE_FULL_TIME_MISSING_POLLS ?? 6);
const MESSAGE_DEDUP_TTL_SECONDS = Number(process.env.LIVE_MESSAGE_DEDUP_TTL_SECONDS ?? 90);
const DISAPPEARANCE_FALLBACK_MAX_AGE_MS = Number(process.env.LIVE_DISAPPEARANCE_FALLBACK_MAX_AGE_MS ?? 20 * 60 * 1000);

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

function isLikelyHalftime(statusShort: string, elapsed: number | null) {
  return (
    statusShort === "HT" ||
    statusShort === "BT" ||
    statusShort === "INT" ||
    (statusShort === "1H" && typeof elapsed === "number" && elapsed >= 40 && elapsed <= 55)
  );
}

function missingPollThresholdFor(oldStatus: string, elapsed: number | null) {
  if (isLikelyHalftime(oldStatus, elapsed)) return Math.max(6, MISSING_POLLS_BEFORE_FULL_TIME);
  if (oldStatus === "2H" && typeof elapsed === "number" && elapsed >= 75) return 2;
  return Math.max(2, MISSING_POLLS_BEFORE_FULL_TIME);
}

function messageKey(subscriberId: string, fixtureId: number, messageHash: string) {
  return `match_msg:${subscriberId}:${fixtureId}:${messageHash}`;
}

async function shouldEmitMessage(subscriberId: string, fixtureId: number, message: string): Promise<boolean> {
  const messageHash = createHash("sha1").update(message).digest("hex");
  const key = messageKey(subscriberId, fixtureId, messageHash);
  const res = await redisConnection.set(key, "1", "EX", MESSAGE_DEDUP_TTL_SECONDS, "NX");
  return res === "OK";
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

async function dispatchTriggers(input: { fixtureId: number; triggers: ReturnType<typeof computeDiffTriggers>["triggers"] }) {
  if (!input.triggers.length) return;

  const subs = await minutoPrismaClient.matchSubscription.findMany({
    where: { fixtureId: input.fixtureId },
    include: { subscriber: true },
  });

  if (!subs.length) return;

  const activeSubsById = new Map<string, (typeof subs)[number]>();
  for (const sub of subs) {
    if (!sub?.subscriber?.isActive) continue;
    if (!activeSubsById.has(sub.subscriberId)) activeSubsById.set(sub.subscriberId, sub);
  }
  if (!activeSubsById.size) return;

  const jobs: Parameters<typeof enqueueWhatsappNotificationsBulk>[0] = [];
  let triggersDedupSkipped = 0;
  let triggersEmitted = 0;
  const activeSubs = activeSubsById.size;

  for (const trigger of input.triggers) {
    const ok = await shouldEmitTrigger(input.fixtureId, `${trigger.type}:${trigger.eventKey}`);
    if (!ok) {
      triggersDedupSkipped++;
      continue;
    }
    triggersEmitted++;

    for (const sub of activeSubsById.values()) {
      const msgOk = await shouldEmitMessage(sub.subscriberId, input.fixtureId, trigger.message);
      if (!msgOk) continue;
      jobs.push({
        phone: sub.subscriber.phoneNumber,
        message: trigger.message,
        fixtureId: input.fixtureId,
        triggerType: trigger.type,
        subscriberId: sub.subscriberId,
        eventKey: trigger.eventKey,
      });
    }
  }

  await enqueueWhatsappNotificationsBulk(jobs);

  if (process.env.NOTIFICATIONS_DEBUG === "true") {
    logInfo("whatsapp.notifications.enqueued", {
      fixtureId: input.fixtureId,
      triggers: input.triggers.length,
      triggersEmitted,
      triggersDedupSkipped,
      subs: subs.length,
      activeSubs,
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
    await dispatchTriggers({ fixtureId, triggers });

    const hasFullTime = triggers.some((t) => t.type === "FULL_TIME");
    if (hasFullTime) {
      const leagueId = fixture.league?.id;
      if (typeof leagueId === "number") {
        invalidateStandingsCache(leagueId, CURRENT_SEASON).catch(() => {});
      }
    }
  }

  if (hasRelevantChanges || !oldState) {
    await setNewState(fixtureId, newState);
  }
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
  await setLastLiveSet(currentIds);
  if (!missing.length) return;

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
      if (s === "FT" || s === "AET" || s === "PEN") continue;

      const fixture = oldState.fixture;
      const elapsed = fixture.fixture.status?.elapsed ?? null;
      const threshold = missingPollThresholdFor(s, elapsed);
      if (missingCount < threshold) continue;

      if (isLikelyHalftime(s, elapsed)) continue;

      const homeTeam = fixture.teams?.home?.name ?? "Home";
      const awayTeam = fixture.teams?.away?.name ?? "Away";
      const leagueName = fixture.league?.name ?? "League";
      const scoreHome = oldState.goalsHome ?? 0;
      const scoreAway = oldState.goalsAway ?? 0;
      const matchUrl = buildMatchUrl({ fixtureId, leagueName, homeTeam, awayTeam });

      const ok = await shouldEmitTrigger(fixtureId, `FULL_TIME_DISAPPEARED:disappeared`);
      if (!ok) continue;

      const subs = await minutoPrismaClient.matchSubscription.findMany({
        where: { fixtureId },
        include: { subscriber: true },
      });
      if (!subs.length) continue;

      const message = templates.fullTime({ homeTeam, awayTeam, leagueName, scoreHome, scoreAway, matchUrl });
      const jobs = subs
        .filter((s) => s.subscriber.isActive)
        .map((sub) => ({
          phone: sub.subscriber.phoneNumber,
          message,
          fixtureId,
          triggerType: "FULL_TIME",
          subscriberId: sub.subscriberId,
          eventKey: "disappeared",
        }));

      await enqueueWhatsappNotificationsBulk(jobs);

      const leagueId = fixture.league?.id;
      if (typeof leagueId === "number") {
        invalidateStandingsCache(leagueId, CURRENT_SEASON).catch(() => {});
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
}

const CURRENT_SEASON = new Date().getFullYear() - 1;

async function pollOnce() {
  const startedAt = Date.now();
  const { fixtures, envelope } = await apiFootballLiveClient.listLiveFixturesWithEnvelope();

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
  logInfo("live.poller.started", { intervalMs: POLL_INTERVAL_MS });

  let running = false;
  const loop = async () => {
    if (running) return;
    running = true;
    try {
      await pollOnce();
    } catch (err: any) {
      logError("live.poll.failed", { err: err?.message ?? String(err) });
    } finally {
      running = false;
    }
  };

  await loop();
  setInterval(loop, POLL_INTERVAL_MS);
}

main().catch((e) => {
  logError("live.poller.fatal", { err: e?.message ?? String(e) });
  process.exitCode = 1;
});
