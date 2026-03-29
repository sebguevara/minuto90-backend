import type {
  ApiFootballOddsBookmaker,
  ApiFootballOddsEnvelope,
  ApiFootballOddsItem,
} from "../domain/football.types";
import { redisFootballCacheStore } from "./football-cache.store";
import {
  getFootballOddsSnapshotFreshTtlSeconds,
  getFootballOddsSnapshotRedisTtlSeconds,
} from "./football-cache-ttl";

export const DEFAULT_ODDS_BOOKMAKER = 11;
export const DEFAULT_ODDS_BET = 1;

export interface FootballOddsFixtureSnapshot {
  fixtureId: number;
  date: string | null;
  bet: number;
  item: ApiFootballOddsItem;
  storedAt: string;
  freshUntil: string;
  staleUntil: string;
}

export interface FootballOddsDateSnapshotMeta {
  date: string;
  bet: number;
  fixtureIds: number[];
  totalFixtures: number;
  storedAt: string;
  freshUntil: string;
  staleUntil: string;
}

type FixtureOddsCacheParams = {
  fixture: number;
  bookmaker?: number;
  bet?: number;
};

type CacheEnvelopeParams = {
  fixtureIds: number[];
  bookmaker?: number;
  bet?: number;
  date?: string;
  cacheOnly?: boolean;
  hydrateMissing?: boolean;
};

function addSeconds(base: Date, seconds: number) {
  return new Date(base.getTime() + seconds * 1000);
}

export function buildFixtureOddsSnapshotKey(fixtureId: number): string {
  return `football:odds:snapshot:fixture=${fixtureId}`;
}

export function buildOddsDateSnapshotMetaKey(date: string): string {
  return `football:odds:snapshot:date=${date}`;
}

export function buildOddsDateRefreshLockKey(date: string): string {
  return `football:odds:snapshot:lock:date=${date}`;
}

export function isFootballOddsSnapshotFresh(
  snapshot: Pick<FootballOddsFixtureSnapshot | FootballOddsDateSnapshotMeta, "freshUntil">,
  now = new Date()
): boolean {
  const freshUntilMs = Date.parse(snapshot.freshUntil);
  return Number.isFinite(freshUntilMs) && freshUntilMs > now.getTime();
}

export function isFootballOddsSnapshotUsable(
  snapshot: Pick<FootballOddsFixtureSnapshot | FootballOddsDateSnapshotMeta, "staleUntil">,
  now = new Date()
): boolean {
  const staleUntilMs = Date.parse(snapshot.staleUntil);
  return Number.isFinite(staleUntilMs) && staleUntilMs > now.getTime();
}

export async function setCachedOddsSnapshotByFixture(params: {
  item: ApiFootballOddsItem;
  date: string;
  bet?: number;
  now?: Date;
}): Promise<void> {
  const { item, date, bet = DEFAULT_ODDS_BET, now = new Date() } = params;
  const fixtureId = item.fixture?.id;
  if (!fixtureId) return;

  const freshTtlSeconds = getFootballOddsSnapshotFreshTtlSeconds(date, now);
  const redisTtlSeconds = getFootballOddsSnapshotRedisTtlSeconds(date, now);
  const payload: FootballOddsFixtureSnapshot = {
    fixtureId,
    date,
    bet,
    item,
    storedAt: now.toISOString(),
    freshUntil: addSeconds(now, freshTtlSeconds).toISOString(),
    staleUntil: addSeconds(now, redisTtlSeconds).toISOString(),
  };

  await redisFootballCacheStore.set(
    buildFixtureOddsSnapshotKey(fixtureId),
    payload,
    redisTtlSeconds
  );
}

export async function setCachedOddsDateSnapshotMeta(params: {
  date: string;
  fixtureIds: number[];
  bet?: number;
  now?: Date;
}): Promise<void> {
  const { date, fixtureIds, bet = DEFAULT_ODDS_BET, now = new Date() } = params;
  const uniqueFixtureIds = Array.from(
    new Set(fixtureIds.filter((fixtureId) => Number.isFinite(fixtureId) && fixtureId > 0))
  );
  const freshTtlSeconds = getFootballOddsSnapshotFreshTtlSeconds(date, now);
  const redisTtlSeconds = getFootballOddsSnapshotRedisTtlSeconds(date, now);
  const payload: FootballOddsDateSnapshotMeta = {
    date,
    bet,
    fixtureIds: uniqueFixtureIds,
    totalFixtures: uniqueFixtureIds.length,
    storedAt: now.toISOString(),
    freshUntil: addSeconds(now, freshTtlSeconds).toISOString(),
    staleUntil: addSeconds(now, redisTtlSeconds).toISOString(),
  };

  await redisFootballCacheStore.set(
    buildOddsDateSnapshotMetaKey(date),
    payload,
    redisTtlSeconds
  );
}

export async function getCachedOddsSnapshotByFixture(
  fixtureId: number
): Promise<FootballOddsFixtureSnapshot | null> {
  return redisFootballCacheStore.get<FootballOddsFixtureSnapshot>(
    buildFixtureOddsSnapshotKey(fixtureId)
  );
}

export async function getCachedOddsDateSnapshotMeta(
  date: string
): Promise<FootballOddsDateSnapshotMeta | null> {
  return redisFootballCacheStore.get<FootballOddsDateSnapshotMeta>(
    buildOddsDateSnapshotMetaKey(date)
  );
}

function pickPreferredBookmaker(
  bookmakers: ApiFootballOddsBookmaker[],
  preferredBookmaker = DEFAULT_ODDS_BOOKMAKER
): ApiFootballOddsBookmaker | null {
  if (!bookmakers.length) return null;
  return bookmakers.find((bookmaker) => bookmaker.id === preferredBookmaker) ?? bookmakers[0] ?? null;
}

export function selectPublicOddsItem(
  item: ApiFootballOddsItem,
  preferredBookmaker = DEFAULT_ODDS_BOOKMAKER
): ApiFootballOddsItem | null {
  const selectedBookmaker = pickPreferredBookmaker(item.bookmakers ?? [], preferredBookmaker);
  if (!selectedBookmaker) return null;

  return {
    ...item,
    bookmakers: [selectedBookmaker],
  };
}

export function buildPublicOddsEnvelope(
  items: ApiFootballOddsItem[],
  params: CacheEnvelopeParams
): ApiFootballOddsEnvelope {
  const preferredBookmaker = params.bookmaker ?? DEFAULT_ODDS_BOOKMAKER;
  const bet = params.bet ?? DEFAULT_ODDS_BET;
  const response = items
    .map((item) => selectPublicOddsItem(item, preferredBookmaker))
    .filter((item): item is ApiFootballOddsItem => !!item);

  const parameters: Record<string, string> = {
    bet: String(bet),
    bookmaker: String(preferredBookmaker),
  };

  if (params.fixtureIds.length === 1) {
    parameters.fixture = String(params.fixtureIds[0]);
  } else if (params.fixtureIds.length > 1) {
    parameters.fixtures = params.fixtureIds.join("-");
  }

  if (params.date) {
    parameters.date = params.date;
  }
  if (params.cacheOnly) {
    parameters.cacheOnly = "true";
  }
  if (params.hydrateMissing) {
    parameters.hydrateMissing = "true";
  }

  return {
    get: "odds",
    parameters,
    errors: [],
    results: response.length,
    paging: { current: 1, total: 1 },
    response,
  };
}

export async function getCachedOddsByFixture(
  params: FixtureOddsCacheParams
): Promise<ApiFootballOddsEnvelope | null> {
  const snapshot = await getCachedOddsSnapshotByFixture(params.fixture);
  if (!snapshot?.item) return null;

  return buildPublicOddsEnvelope([snapshot.item], {
    fixtureIds: [params.fixture],
    bookmaker: params.bookmaker,
    bet: params.bet,
    date: snapshot.date ?? undefined,
    cacheOnly: true,
  });
}
