import { logInfo, logWarn } from "../../../shared/logging/logger";
import { redisConnection } from "../../../shared/redis/redis.connection";
import type { ApiFootballOddsEnvelope, ApiFootballOddsItem } from "../domain/football.types";
import { footballApiClient } from "./football-api.client";
import {
  getFootballOddsDatePageConcurrency,
  getFootballOddsDateOffsetDays,
  getFootballOddsDateRefreshLockTtlSeconds,
  getFootballOddsHistoryPastDays,
} from "./football-cache-ttl";
import {
  buildOddsDateRefreshLockKey,
  buildPublicOddsEnvelope,
  DEFAULT_ODDS_BET,
  DEFAULT_ODDS_BOOKMAKER,
  getCachedOddsDateSnapshotMeta,
  getCachedOddsSnapshotByFixture,
  isFootballOddsSnapshotFresh,
  isFootballOddsSnapshotUsable,
  setCachedOddsDateSnapshotMeta,
  setCachedOddsSnapshotByFixture,
} from "./football-odds-cache";

const LOCK_WAIT_MS = 1000;
const LOCK_WAIT_ATTEMPTS = 90;

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function mapWithConcurrency<T, TResult>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<TResult>
) {
  if (!items.length) return [] as TResult[];

  const limit = Math.min(Math.max(1, concurrency), items.length);
  const queue = [...items];
  const results: TResult[] = [];

  const worker = async () => {
    for (;;) {
      const next = queue.shift();
      if (next === undefined) return;
      results.push(await mapper(next));
    }
  };

  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

async function acquireDateRefreshLock(date: string) {
  const key = buildOddsDateRefreshLockKey(date);
  const token = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const ttlSeconds = getFootballOddsDateRefreshLockTtlSeconds();
  const status = await redisConnection.set(key, token, "EX", ttlSeconds, "NX");
  if (status !== "OK") {
    return null;
  }
  return { key, token };
}

async function releaseDateRefreshLock(key: string, token: string) {
  await redisConnection.eval(
    "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
    1,
    key,
    token
  );
}

async function waitForDateSnapshotMeta(date: string) {
  for (let attempt = 0; attempt < LOCK_WAIT_ATTEMPTS; attempt++) {
    const meta = await getCachedOddsDateSnapshotMeta(date);
    if (meta && isFootballOddsSnapshotUsable(meta)) {
      return meta;
    }
    await delay(LOCK_WAIT_MS);
  }
  return null;
}

async function fetchDateOddsPages(
  date: string,
  timezone: string,
  bet: number
): Promise<ApiFootballOddsItem[]> {
  const firstPage = await footballApiClient.getOdds({
    date,
    timezone,
    bet,
    page: 1,
  });

  const totalPages = Math.max(firstPage.paging?.total ?? 1, 1);
  const pages = Array.from({ length: Math.max(totalPages - 1, 0) }, (_, index) => index + 2);
  const pageConcurrency = getFootballOddsDatePageConcurrency();
  const remainingPages = await mapWithConcurrency(pages, pageConcurrency, async (page) => {
    const envelope = await footballApiClient.getOdds({
      date,
      timezone,
      bet,
      page,
    });
    return envelope.response ?? [];
  });

  return [
    ...(firstPage.response ?? []),
    ...remainingPages.flatMap((items) => items),
  ];
}

export async function writeOddsItemsToPerFixtureCache(
  items: ApiFootballOddsItem[],
  date: string,
  bet = DEFAULT_ODDS_BET
): Promise<number> {
  const uniqueItems = new Map<number, ApiFootballOddsItem>();
  for (const item of items) {
    const fixtureId = item.fixture?.id;
    if (!fixtureId) continue;
    uniqueItems.set(fixtureId, item);
  }

  const now = new Date();
  await Promise.all(
    Array.from(uniqueItems.values()).map((item) =>
      setCachedOddsSnapshotByFixture({ item, date, bet, now })
    )
  );
  await setCachedOddsDateSnapshotMeta({
    date,
    fixtureIds: Array.from(uniqueItems.keys()),
    bet,
    now,
  });

  return uniqueItems.size;
}

export async function warmOddsForDate(
  date: string,
  timezone: string,
  _bookmaker: number = DEFAULT_ODDS_BOOKMAKER,
  bet: number = DEFAULT_ODDS_BET
): Promise<number> {
  const result = await refreshOddsSnapshotForDate(date, timezone, bet);
  return result.written;
}

export async function refreshOddsSnapshotForDate(
  date: string,
  timezone: string,
  bet = DEFAULT_ODDS_BET
): Promise<{ written: number; refreshed: boolean; skipped?: "locked" }> {
  const lock = await acquireDateRefreshLock(date);
  if (!lock) {
    return { written: 0, refreshed: false, skipped: "locked" };
  }

  try {
    const items = await fetchDateOddsPages(date, timezone, bet);
    const written = await writeOddsItemsToPerFixtureCache(items, date, bet);
    logInfo("football.odds.snapshot.refreshed", {
      date,
      timezone,
      bet,
      written,
    });
    return { written, refreshed: true };
  } finally {
    await releaseDateRefreshLock(lock.key, lock.token);
  }
}

export async function ensureOddsSnapshotForDate(
  date: string,
  timezone: string,
  bet = DEFAULT_ODDS_BET
) {
  const currentMeta = await getCachedOddsDateSnapshotMeta(date);
  const offsetDays = getFootballOddsDateOffsetDays(date);
  if (offsetDays < 0 && Math.abs(offsetDays) <= getFootballOddsHistoryPastDays()) {
    if (currentMeta && isFootballOddsSnapshotUsable(currentMeta)) {
      return currentMeta;
    }
  }
  if (currentMeta && isFootballOddsSnapshotFresh(currentMeta)) {
    return currentMeta;
  }

  try {
    const refreshResult = await refreshOddsSnapshotForDate(date, timezone, bet);
    if (refreshResult.skipped === "locked") {
      const awaitedMeta = await waitForDateSnapshotMeta(date);
      if (awaitedMeta) {
        return awaitedMeta;
      }
      if (currentMeta && isFootballOddsSnapshotUsable(currentMeta)) {
        return currentMeta;
      }
      throw new Error(`Odds snapshot refresh locked for ${date}`);
    }

    const refreshedMeta = await getCachedOddsDateSnapshotMeta(date);
    if (refreshedMeta) {
      return refreshedMeta;
    }
  } catch (error) {
    if (currentMeta && isFootballOddsSnapshotUsable(currentMeta)) {
      logWarn("football.odds.snapshot.refresh_failed_serving_stale", {
        date,
        timezone,
        bet,
        error: error instanceof Error ? error.message : String(error),
      });
      return currentMeta;
    }
    throw error;
  }

  return currentMeta;
}

export async function getCachedOddsItemsByFixtureIds(
  fixtureIds: number[],
  includeStale = true
): Promise<ApiFootballOddsItem[]> {
  const uniqueOrder = [...new Set(fixtureIds.filter((fixtureId) => fixtureId > 0))];
  const snapshots = await Promise.all(
    uniqueOrder.map((fixtureId) => getCachedOddsSnapshotByFixture(fixtureId))
  );

  return snapshots.flatMap((snapshot) => {
    if (!snapshot?.item) return [];
    if (!includeStale && !isFootballOddsSnapshotFresh(snapshot)) {
      return [];
    }
    if (includeStale && !isFootballOddsSnapshotUsable(snapshot)) {
      return [];
    }
    return [snapshot.item];
  });
}

export async function getCachedOddsResponse(
  fixtureIds: number[],
  bookmaker: number,
  bet: number,
  date?: string
): Promise<ApiFootballOddsEnvelope> {
  let targetFixtureIds = fixtureIds;
  if (!targetFixtureIds.length && date) {
    const meta = await getCachedOddsDateSnapshotMeta(date);
    targetFixtureIds = meta?.fixtureIds ?? [];
  }

  const items = await getCachedOddsItemsByFixtureIds(targetFixtureIds, true);
  return buildPublicOddsEnvelope(items, {
    fixtureIds: targetFixtureIds,
    bookmaker,
    bet,
    date,
    cacheOnly: true,
  });
}

export async function hydrateFixturesOddsResponse(
  fixtureIds: number[],
  bookmaker: number,
  bet: number,
  options?: {
    date?: string;
    timezone?: string;
  }
): Promise<ApiFootballOddsEnvelope> {
  const uniqueOrder = [...new Set(fixtureIds.filter((fixtureId) => fixtureId > 0))];
  const date = options?.date;
  const timezone = options?.timezone?.trim() || "UTC";

  let targetFixtureIds = uniqueOrder;

  if (date) {
    const meta = await ensureOddsSnapshotForDate(date, timezone, bet);
    if (!targetFixtureIds.length) {
      targetFixtureIds = meta?.fixtureIds ?? [];
    }
  } else if (targetFixtureIds.length) {
    logWarn("football.odds.snapshot.hydrate_without_date", {
      fixtureIds: targetFixtureIds,
      bookmaker,
      bet,
    });
  }

  let items = await getCachedOddsItemsByFixtureIds(targetFixtureIds, true);

  // If caller requested concrete fixtures and some are missing, force-refresh snapshot for
  // this date/timezone and retry missing IDs. This prevents stale/foreign snapshot windows
  // (e.g. UTC-prewarmed snapshot reused for America/* request) from returning empty odds.
  if (date && targetFixtureIds.length) {
    const cachedIds = new Set(
      items
        .map((item) => item.fixture?.id)
        .filter((fixtureId): fixtureId is number => Number.isFinite(fixtureId) && fixtureId > 0)
    );
    const missingFixtureIds = targetFixtureIds.filter((fixtureId) => !cachedIds.has(fixtureId));

    if (missingFixtureIds.length) {
      logWarn("football.odds.snapshot.partial_cache_hit", {
        date,
        timezone,
        requested: targetFixtureIds.length,
        cached: targetFixtureIds.length - missingFixtureIds.length,
        missing: missingFixtureIds.length,
      });

      const refreshResult = await refreshOddsSnapshotForDate(date, timezone, bet);
      if (refreshResult.skipped === "locked") {
        await waitForDateSnapshotMeta(date);
      }
      const refreshedMissingItems = await getCachedOddsItemsByFixtureIds(missingFixtureIds, true);

      if (refreshedMissingItems.length) {
        const mergedByFixture = new Map<number, ApiFootballOddsItem>();
        for (const item of items) {
          const fixtureId = item.fixture?.id;
          if (fixtureId) mergedByFixture.set(fixtureId, item);
        }
        for (const item of refreshedMissingItems) {
          const fixtureId = item.fixture?.id;
          if (fixtureId) mergedByFixture.set(fixtureId, item);
        }
        items = Array.from(mergedByFixture.values());
      }
    }
  }

  return buildPublicOddsEnvelope(items, {
    fixtureIds: targetFixtureIds,
    bookmaker,
    bet,
    date,
    hydrateMissing: true,
  });
}
