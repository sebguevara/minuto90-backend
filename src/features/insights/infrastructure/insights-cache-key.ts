type MatchInsightsCacheTarget = "match_summary" | "match_streaks" | "key_insight";
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

export function buildFeaturedMatchesCacheKey(date: string, timezone?: string | null) {
  const normalizedTimezone =
    timezone?.trim().replace(/[^A-Za-z0-9/_-]+/g, "-").replace(/\//g, "__") || "UTC";
  return `minuto90:${ENV}:insights:featured:${date}:${normalizedTimezone}:v4`;
}

export function buildFeaturedMatchesLastGoodCacheKey(cacheKey: string) {
  return `${cacheKey}:last_good`;
}

/**
 * AI-reranked variant of the featured matches cache. Kept on a separate key so the
 * deterministic cache (the request-path safety net) is never overwritten by LLM output.
 */
export function buildFeaturedMatchesAiRankedCacheKey(date: string, timezone?: string | null) {
  return `${buildFeaturedMatchesCacheKey(date, timezone)}:ai_ranked`;
}

export function buildInsightsLockKey(cacheKey: string) {
  return `${cacheKey}:lock`;
}
