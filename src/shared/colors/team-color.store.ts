import { logWarn } from '../logging/logger';
import { redisConnection } from '../redis/redis.connection';
import type { TeamColors } from './team-color-extractor';

// Colors rarely change — 30 days TTL
const TTL_30_DAYS = 60 * 60 * 24 * 30;

export async function getCachedTeamColors(cacheKey: string): Promise<TeamColors | null> {
  try {
    const raw = await redisConnection.get(cacheKey);
    if (!raw) return null;
    return JSON.parse(raw) as TeamColors;
  } catch (err) {
    logWarn('team_colors.cache.get_failed', {
      key: cacheKey,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function deleteCachedTeamColors(cacheKey: string): Promise<void> {
  try {
    await redisConnection.del(cacheKey);
  } catch (err) {
    logWarn('team_colors.cache.del_failed', {
      key: cacheKey,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function setCachedTeamColors(
  cacheKey: string,
  colors: TeamColors
): Promise<void> {
  try {
    await redisConnection.set(cacheKey, JSON.stringify(colors), 'EX', TTL_30_DAYS);
  } catch (err) {
    logWarn('team_colors.cache.set_failed', {
      key: cacheKey,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
