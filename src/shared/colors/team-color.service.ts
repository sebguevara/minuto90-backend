import { buildTeamColorCacheKey } from './team-color-cache-key';
import {
  extractTeamColors,
  FALLBACK_COLORS,
  type TeamColors,
} from './team-color-extractor';
import { getCachedTeamColors, setCachedTeamColors } from './team-color.store';
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
    logInfo('team_colors.resolve.cache_hit', {
      sport,
      teamId,
      cacheKey,
      colors: cached,
    });
    return cached;
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
  } else {
    logInfo('team_colors.resolve.extracted', {
      sport,
      teamId,
      cacheKey,
      hasLogoUrl: Boolean(logoUrl),
      colors,
    });
  }

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

  logInfo('team_colors.resolve.cache_lookup', {
    sport,
    teamId,
    cacheKey,
    hit: Boolean(cached),
    colors: cached,
  });

  return cached;
}
