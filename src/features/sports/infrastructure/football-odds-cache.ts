import type { ApiFootballOddsEnvelope, GetOddsQuery } from "../domain/football.types";
import { redisFootballCacheStore } from "./football-cache.store";
import { buildFootballCacheKey } from "./football-cache-key";

/** @deprecated Usar getFootballOddsPerFixtureCacheTtlSeconds en football-cache-ttl (env FOOTBALL_ODDS_FIXTURE_TTL_SECONDS). */
export const FOOTBALL_ODDS_CACHE_TTL_SECONDS = 60 * 60;
export const DEFAULT_ODDS_BOOKMAKER = 11;
export const DEFAULT_ODDS_BET = 1;

type FixtureOddsCacheParams = {
  fixture: number;
  bookmaker?: number;
  bet?: number;
};

export function buildFixtureOddsCacheParams(params: FixtureOddsCacheParams): GetOddsQuery {
  return {
    fixture: params.fixture,
    bookmaker: params.bookmaker ?? DEFAULT_ODDS_BOOKMAKER,
    bet: params.bet ?? DEFAULT_ODDS_BET,
  };
}

export function buildFixtureOddsCacheKey(params: FixtureOddsCacheParams): string {
  return buildFootballCacheKey("/odds", buildFixtureOddsCacheParams(params));
}

export async function getCachedOddsByFixture(
  params: FixtureOddsCacheParams
): Promise<ApiFootballOddsEnvelope | null> {
  return redisFootballCacheStore.get<ApiFootballOddsEnvelope>(buildFixtureOddsCacheKey(params));
}
