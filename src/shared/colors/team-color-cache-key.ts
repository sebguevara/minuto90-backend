/**
 * Builds the Redis cache key for team colors.
 * Format: team:colors:{sport}:{teamId}
 */
export function buildTeamColorCacheKey(sport: string, teamId: number): string {
  return `team:colors:${sport}:${teamId}`;
}
