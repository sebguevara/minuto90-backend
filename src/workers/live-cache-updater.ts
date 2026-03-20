import { buildFootballCacheKey } from "../features/sports/infrastructure/football-cache-key";
import { redisFootballCacheStore } from "../features/sports/infrastructure/football-cache.store";
import { redisConnection } from "../shared/redis/redis.connection";
import { logInfo, logWarn } from "../shared/logging/logger";

const LIVE_CACHE_TTL_SECONDS = 10;

export async function updateLiveFixturesCache(envelope: unknown): Promise<void> {
  const key = buildFootballCacheKey("/fixtures", { live: "all" });
  try {
    await redisFootballCacheStore.set(key, envelope, LIVE_CACHE_TTL_SECONDS);
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
