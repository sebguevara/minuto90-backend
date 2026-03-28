import { logWarn } from "../../../shared/logging/logger";
import type { ApiFootballOddsEnvelope, ApiFootballOddsItem } from "../domain/football.types";
import { footballApiClient } from "./football-api.client";
import { buildFootballCacheKey } from "./football-cache-key";
import { getFootballOddsPerFixtureCacheTtlSeconds } from "./football-cache-ttl";
import { redisFootballCacheStore } from "./football-cache.store";
import {
  DEFAULT_ODDS_BET,
  DEFAULT_ODDS_BOOKMAKER,
  getCachedOddsByFixture,
} from "./football-odds-cache";

function makePerFixtureOddsEnvelope(
  item: ApiFootballOddsItem,
  bookmaker: number,
  bet: number
): ApiFootballOddsEnvelope {
  const fixtureId = item.fixture.id;
  return {
    get: "odds",
    parameters: {
      fixture: String(fixtureId),
      bookmaker: String(bookmaker),
      bet: String(bet),
    },
    errors: [],
    results: 1,
    paging: { current: 1, total: 1 },
    response: [item],
  };
}

/**
 * Escribe en Redis una entrada por fixture (misma clave que getOdds({ fixture })).
 * Usado tras traer odds por fecha (una petición) para servir listados desde caché.
 */
export async function writeOddsItemsToPerFixtureCache(
  items: ApiFootballOddsItem[],
  bookmaker: number,
  bet: number
): Promise<number> {
  const ttl = getFootballOddsPerFixtureCacheTtlSeconds();
  let written = 0;
  for (const item of items) {
    const fixtureId = item.fixture?.id;
    if (!fixtureId) continue;
    const envelope = makePerFixtureOddsEnvelope(item, bookmaker, bet);
    const key = buildFootballCacheKey("/odds", { fixture: fixtureId, bookmaker, bet });
    await redisFootballCacheStore.set(key, envelope, ttl);
    written++;
  }
  return written;
}

const MAX_ODDS_DATE_PAGES = 40;

/**
 * Precarga odds del día vía API (/odds?date&timezone&bookmaker&bet), paginando,
 * y persiste cada fixture en Redis con TTL largo (ver FOOTBALL_ODDS_FIXTURE_TTL_SECONDS).
 */
export async function warmOddsForDate(
  date: string,
  timezone: string,
  bookmaker: number = DEFAULT_ODDS_BOOKMAKER,
  bet: number = DEFAULT_ODDS_BET
): Promise<number> {
  let totalWritten = 0;
  let page = 1;

  while (page <= MAX_ODDS_DATE_PAGES) {
    let envelope: ApiFootballOddsEnvelope;
    try {
      envelope = await footballApiClient.getOdds({ date, timezone, bookmaker, bet, page });
    } catch (err) {
      logWarn("football.odds.warm_date.page_failed", {
        date,
        page,
        error: err instanceof Error ? err.message : String(err),
      });
      break;
    }

    const items = envelope.response ?? [];
    if (!items.length) {
      break;
    }

    totalWritten += await writeOddsItemsToPerFixtureCache(items, bookmaker, bet);

    const totalPages = envelope.paging?.total ?? 1;
    if (page >= totalPages) {
      break;
    }
    page++;
  }

  return totalWritten;
}

/**
 * Devuelve odds para los fixtures pedidos: lee Redis y solo para faltantes llama
 * a la API (una petición por fixture, secuencial; rellena caché vía footballApiClient).
 */
export async function hydrateFixturesOddsResponse(
  fixtureIds: number[],
  bookmaker: number,
  bet: number
): Promise<ApiFootballOddsEnvelope> {
  const uniqueOrder = [...new Set(fixtureIds.filter((id) => Number.isFinite(id) && id > 0))];
  const byId = new Map<number, ApiFootballOddsItem>();

  for (const id of uniqueOrder) {
    const cached = await getCachedOddsByFixture({ fixture: id, bookmaker, bet });
    const item = cached?.response?.[0];
    if (item?.fixture?.id) {
      byId.set(id, item);
    }
  }

  const missingIds = uniqueOrder.filter((id) => !byId.has(id));
  const rawConcurrency = Number(process.env.FOOTBALL_ODDS_HYDRATE_CONCURRENCY);
  const maxParallel =
    Number.isFinite(rawConcurrency) && rawConcurrency >= 1
      ? Math.min(12, Math.floor(rawConcurrency))
      : 6;

  const queue = [...missingIds];
  const worker = async () => {
    for (;;) {
      const id = queue.shift();
      if (id === undefined) {
        return;
      }
      try {
        const env = await footballApiClient.getOdds({ fixture: id, bookmaker, bet });
        const item = env.response?.[0];
        if (item?.fixture?.id) {
          byId.set(id, item);
        }
      } catch (err) {
        logWarn("football.odds.hydrate.fixture_failed", {
          fixtureId: id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  };

  const workers = Math.min(maxParallel, queue.length || 1);
  await Promise.all(Array.from({ length: workers }, () => worker()));

  const response = uniqueOrder
    .map((id) => byId.get(id))
    .filter((item): item is ApiFootballOddsItem => !!item);

  return {
    get: "odds",
    parameters: {
      fixtures: uniqueOrder.join("-"),
      bookmaker: String(bookmaker),
      bet: String(bet),
      hydrateMissing: "true",
    },
    errors: [],
    results: response.length,
    paging: { current: 1, total: 1 },
    response,
  };
}
