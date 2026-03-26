type MatchInsightsCacheTarget = "match_summary" | "match_streaks";

const ENV = process.env.NODE_ENV ?? "dev";

export function buildMatchInsightsCacheKey(
  target: MatchInsightsCacheTarget,
  fixtureId: number
) {
  return `minuto90:${ENV}:insights:${target}:${fixtureId}:v1`;
}

export function buildDailyInsightsCacheKey(date: string) {
  return `minuto90:${ENV}:insights:daily:${date}:v1`;
}

export function buildFeaturedMatchesCacheKey(date: string) {
  return `minuto90:${ENV}:insights:featured:${date}:v1`;
}

export function buildInsightsLockKey(cacheKey: string) {
  return `${cacheKey}:lock`;
}

