import { buildFootballCacheKey } from "../features/sports/infrastructure/football-cache-key";
import { redisFootballCacheStore } from "../features/sports/infrastructure/football-cache.store";
import {
  createFootballLiveSnapshot,
  setFootballLiveSnapshot,
} from "../features/sports/infrastructure/football-live.snapshot";
import { redisConnection } from "../shared/redis/redis.connection";
import { logInfo, logWarn } from "../shared/logging/logger";
import type { ApiFootballFixtureEvent } from "../features/notifications/infrastructure/api-football-live.client";

const FIXTURE_EVENTS_TTL_SECONDS = 6 * 60 * 60; // 6 hours
const fixtureEventsKey = (fixtureId: number) => `football:fixture_events:${fixtureId}`;

/**
 * Persists a fixture's events in Redis so they remain available after the match leaves
 * the live snapshot (which has a very short TTL). Call this on every poll while the
 * fixture has events, so the latest state is always stored.
 */
export async function saveFixtureEvents(
  fixtureId: number,
  events: ApiFootballFixtureEvent[]
): Promise<void> {
  if (!events.length) return;
  try {
    await redisConnection.set(
      fixtureEventsKey(fixtureId),
      JSON.stringify(events),
      "EX",
      FIXTURE_EVENTS_TTL_SECONDS
    );
  } catch (err: any) {
    logWarn("live-cache.fixture_events_save_failed", { fixtureId, err: err?.message ?? String(err) });
  }
}

/**
 * Bulk-fetches stored events for multiple fixture IDs.
 * Returns a Map<fixtureId, events[]> only for IDs that have cached events.
 */
export async function getFixtureEventsMap(
  fixtureIds: number[]
): Promise<Map<number, ApiFootballFixtureEvent[]>> {
  if (!fixtureIds.length) return new Map();
  const keys = fixtureIds.map(fixtureEventsKey);
  try {
    const values = await redisConnection.mget(...keys);
    const result = new Map<number, ApiFootballFixtureEvent[]>();
    for (let i = 0; i < fixtureIds.length; i++) {
      const raw = values[i];
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          result.set(fixtureIds[i], parsed as ApiFootballFixtureEvent[]);
        }
      } catch { /* ignore malformed */ }
    }
    return result;
  } catch (err: any) {
    logWarn("live-cache.fixture_events_get_failed", { err: err?.message ?? String(err) });
    return new Map();
  }
}

const LIVE_POLL_INTERVAL_MS = Number(process.env.LIVE_POLL_INTERVAL_MS ?? 15000);
const LIVE_CACHE_TTL_SECONDS = Number(
  process.env.LIVE_CACHE_TTL_SECONDS ??
    Math.max(45, Math.ceil(LIVE_POLL_INTERVAL_MS / 1000) * 3)
);

export async function updateLiveFixturesCache(envelope: unknown): Promise<void> {
  const key = buildFootballCacheKey("/fixtures", { live: "all" });
  try {
    await redisFootballCacheStore.set(key, envelope, LIVE_CACHE_TTL_SECONDS);
    await setFootballLiveSnapshot(
      createFootballLiveSnapshot(
        envelope as import("../features/notifications/infrastructure/api-football-live.client").LiveFixturesEnvelope
      )
    );
  } catch (err: any) {
    logWarn("live-cache.update_failed", { key, err: err?.message ?? String(err) });
  }
}

export async function invalidateStandingsCache(leagueId: number, season: number): Promise<void> {
  const key = buildFootballCacheKey("/standings", { league: leagueId, season });
  try {
    await redisConnection.del(key);
    logInfo("live-cache.standings_invalidated", { key, leagueId, season });
  } catch (err: any) {
    logWarn("live-cache.standings_invalidate_failed", { key, err: err?.message ?? String(err) });
  }
}
