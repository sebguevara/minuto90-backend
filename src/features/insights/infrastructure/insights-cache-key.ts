type MatchInsightsCacheTarget = "match_summary" | "match_streaks";
export type MatchSummaryStateSlot = "prematch" | "live" | "finished";

const ENV = process.env.NODE_ENV ?? "dev";

export function buildMatchInsightsCacheKey(
  target: MatchInsightsCacheTarget,
  fixtureId: number
) {
  return `minuto90:${ENV}:insights:${target}:${fixtureId}:v1`;
}

export function buildMatchSummaryStateCacheKey(
  fixtureId: number,
  stateSlot: MatchSummaryStateSlot
) {
  return `minuto90:${ENV}:insights:match_summary:${stateSlot}:${fixtureId}:v1`;
}

export function buildDailyInsightsCacheKey(date: string) {
  return `minuto90:${ENV}:insights:daily:${date}:v1`;
}

export function buildFeaturedMatchesCacheKey(date: string, userCountry?: string | null) {
  const normalizedCountry =
    userCountry?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "global";
  return `minuto90:${ENV}:insights:featured:${date}:${normalizedCountry}:v2`;
}

export function buildInsightsLockKey(cacheKey: string) {
  return `${cacheKey}:lock`;
}
