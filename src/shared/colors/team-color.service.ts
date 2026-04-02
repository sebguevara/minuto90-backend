import { buildTeamColorCacheKey } from './team-color-cache-key';
import {
  extractTeamColors,
  FALLBACK_COLORS,
  type TeamColors,
} from './team-color-extractor';
import { getCachedTeamColors, setCachedTeamColors, deleteCachedTeamColors } from './team-color.store';
import { logInfo, logWarn } from '../logging/logger';

export type { TeamColors };
export { FALLBACK_COLORS };

/**
 * Returns team colors: checks Redis first, computes from logo if missing, caches result.
 * @param sport  Sport identifier (e.g. "football", "nba")
 * @param teamId External team ID (e.g. API-Football team ID)
 * @param logoUrl URL of the team logo image
 */
export async function getTeamColors(
  sport: string,
  teamId: number,
  logoUrl: string
): Promise<TeamColors> {
  const cacheKey = buildTeamColorCacheKey(sport, teamId);

  const cached = await getCachedTeamColors(cacheKey);
  if (cached) {
    const isCachedFallback =
      cached.dark === FALLBACK_COLORS.dark && cached.light === FALLBACK_COLORS.light;
    if (!isCachedFallback) {
      logInfo('team_colors.resolve.cache_hit', { sport, teamId, cacheKey, colors: cached });
      return cached;
    }
    // Stale fallback in Redis — evict it so we re-extract below.
    await deleteCachedTeamColors(cacheKey);
    logWarn('team_colors.resolve.stale_fallback_evicted', { sport, teamId, cacheKey });
  }

  const colors = await extractTeamColors(logoUrl);
  const isFallback =
    colors.dark === FALLBACK_COLORS.dark && colors.light === FALLBACK_COLORS.light;

  if (isFallback) {
    logWarn('team_colors.resolve.extract_fallback', {
      sport,
      teamId,
      cacheKey,
      hasLogoUrl: Boolean(logoUrl),
      colors,
    });
    // Don't cache fallback colors — next request will retry extraction.
    return colors;
  }

  logInfo('team_colors.resolve.extracted', {
    sport,
    teamId,
    cacheKey,
    hasLogoUrl: Boolean(logoUrl),
    colors,
  });

  await setCachedTeamColors(cacheKey, colors);
  return colors;
}

/**
 * Returns cached team colors without computing them if missing.
 * Use in hot paths where computation latency is not acceptable.
 */
export async function getTeamColorsIfCached(
  sport: string,
  teamId: number
): Promise<TeamColors | null> {
  const cacheKey = buildTeamColorCacheKey(sport, teamId);
  const cached = await getCachedTeamColors(cacheKey);

  if (!cached) {
    logInfo('team_colors.resolve.cache_lookup', { sport, teamId, cacheKey, hit: false, colors: null });
    return null;
  }

  const isFallback = cached.dark === FALLBACK_COLORS.dark && cached.light === FALLBACK_COLORS.light;
  if (isFallback) {
    // Stale fallback — evict and signal cache miss so caller can re-extract.
    await deleteCachedTeamColors(cacheKey);
    logWarn('team_colors.resolve.stale_fallback_evicted', { sport, teamId, cacheKey });
    return null;
  }

  logInfo('team_colors.resolve.cache_lookup', { sport, teamId, cacheKey, hit: true, colors: cached });
  return cached;
}
