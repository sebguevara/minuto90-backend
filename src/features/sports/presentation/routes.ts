import { Elysia } from "elysia";
import type {
  ApiFootballFixtureItem,
  GetCountriesQuery,
  GetFixtureEventsQuery,
  GetFixtureHeadToHeadQuery,
  GetFixtureLineupsQuery,
  GetFixturePlayersQuery,
  GetFixtureRoundsQuery,
  GetFixtureStatisticsQuery,
  GetFixturesQuery,
  GetInjuriesQuery,
  GetLeaguesQuery,
  GetOddsBetsQuery,
  GetOddsBookmakersQuery,
  GetOddsLiveBetsQuery,
  GetOddsLiveQuery,
  GetOddsMappingQuery,
  GetOddsQuery,
  GetPlayerProfilesQuery,
  GetPlayersQuery,
  GetPlayerSquadsQuery,
  GetPlayerTeamsQuery,
  GetPredictionsQuery,
  GetSidelinedQuery,
  GetStandingsQuery,
  GetTeamsQuery,
  GetTeamSeasonsQuery,
  GetTeamStatisticsQuery,
  GetTopPlayersQuery,
  GetTransfersQuery,
  GetTrophiesQuery,
  GetVenuesQuery,
} from "../domain/football.types";
import {
  createFootballValidationError,
  FootballModuleError,
} from "../domain/football.errors";
import {
  footballService,
  type FootballServiceContract,
} from "../application/football.service";
import {
  createEmptyFootballLiveSnapshot,
  getFootballLiveSnapshot,
} from "../infrastructure/football-live.snapshot";
import { getFixtureEventsMap } from "../../../workers/live-cache-updater";
import { DEFAULT_ODDS_BET, DEFAULT_ODDS_BOOKMAKER } from "../infrastructure/football-odds-cache";
import {
  getCachedOddsResponse as getCachedPrematchOddsResponse,
  hydrateFixturesOddsResponse,
} from "../infrastructure/football-odds-hydration";
import { logInfo, logWarn } from "../../../shared/logging/logger";
import { redisConnection } from "../../../shared/redis/redis.connection";
import type { StoredMatchState } from "../../notifications/application/diff-engine";
import type { ApiFootballFixtureEvent } from "../../notifications/infrastructure/api-football-live.client";
import {
  coachsQuerySchema,
  countriesQuerySchema,
  fixtureEventsQuerySchema,
  fixtureHeadToHeadQuerySchema,
  fixtureLineupsQuerySchema,
  fixturePlayersQuerySchema,
  fixtureRoundsQuerySchema,
  fixtureStatisticsQuerySchema,
  fixturesQuerySchema,
  injuriesQuerySchema,
  leaguesQuerySchema,
  oddsBetsQuerySchema,
  oddsBookmakersQuerySchema,
  oddsLiveBetsQuerySchema,
  oddsLiveQuerySchema,
  oddsMappingQuerySchema,
  oddsQuerySchema,
  playerProfilesQuerySchema,
  playersQuerySchema,
  playerSquadsQuerySchema,
  playerTeamsQuerySchema,
  predictionsQuerySchema,
  sidelinedQuerySchema,
  standingsQuerySchema,
  teamSeasonsQuerySchema,
  teamStatisticsQuerySchema,
  teamsQuerySchema,
  topPlayersQuerySchema,
  transfersQuerySchema,
  trophiesQuerySchema,
  venuesQuerySchema,
} from "./football.schemas";
import { footballSwaggerExamples } from "./football.swagger.examples";
import { createSwaggerDetail } from "./swagger.helpers";

const FOOTBALL_LIVE_STREAM_POLL_MS = Number(
  process.env.FOOTBALL_LIVE_STREAM_POLL_MS ?? 1000
);
const FOOTBALL_LIVE_STREAM_KEEPALIVE_MS = Number(
  process.env.FOOTBALL_LIVE_STREAM_KEEPALIVE_MS ?? 15000
);

type FootballLiveHomeFixture = {
  fixture: {
    id: number;
    date?: string;
    status?: {
      short?: string;
      elapsed?: number | null;
    };
  };
  goals?: {
    home?: number | null;
    away?: number | null;
  };
  /** Eventos del snapshot live (goles, tarjetas, etc.) para clientes que hacen diff in-app. */
  events?: ApiFootballFixtureEvent[];
};

type FootballLiveClockAnchor = {
  elapsed: number;
  anchoredAtMs: number;
  serverNowMs: number;
  source: "match_state" | "snapshot";
};

function isLiveStatusShort(statusShort: string | null | undefined): boolean {
  if (!statusShort) return false;
  return LIVE_STATUS_SHORTS.has(statusShort);
}

function shouldApplyLiveOverlay(
  baseFixture: Record<string, any>,
  liveFixture: FootballLiveHomeFixture
): boolean {
  const baseStatusShort = baseFixture?.fixture?.status?.short;
  const liveStatusShort = liveFixture?.fixture?.status?.short;

  // If base already says the match is no longer live, trust base over a stale live snapshot.
  if (!isLiveStatusShort(baseStatusShort)) {
    return false;
  }

  // Ignore malformed or non-live snapshot entries.
  if (!isLiveStatusShort(liveStatusShort)) {
    return false;
  }

  return true;
}

function formatDateInTimeZone(ms: number, timeZone: string): string | null {
  if (!Number.isFinite(ms)) return null;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(ms));
  } catch {
    return null;
  }
}

function fixtureBelongsToRequestedDate(
  fixture: Record<string, any> | null | undefined,
  requestedDate: string,
  requestedTimezone: string
): boolean {
  const timestamp = fixture?.fixture?.timestamp;
  const kickoff = fixture?.fixture?.date;

  // 1) ISO slice (the ISO comes from api-sports already converted to the
  //    requested timezone, so this is usually the source of truth).
  if (typeof kickoff === "string" && kickoff.length >= 10) {
    if (kickoff.slice(0, 10) === requestedDate) {
      return true;
    }
  }

  // 2) Fallback: convert timestamp → requested timezone day string.
  const ms =
    typeof timestamp === "number" && Number.isFinite(timestamp)
      ? timestamp * 1000
      : typeof kickoff === "string"
        ? Date.parse(kickoff)
        : NaN;

  const dayInTz = formatDateInTimeZone(ms, requestedTimezone);
  if (dayInTz && dayInTz === requestedDate) {
    return true;
  }

  return false;
}

function filterFixturesByRequestedDate<TFixture extends Record<string, any>>(
  fixtures: TFixture[],
  requestedDate: string | undefined,
  requestedTimezone: string
): TFixture[] {
  if (!requestedDate) {
    return fixtures;
  }

  return fixtures.filter((fixture) =>
    fixtureBelongsToRequestedDate(fixture, requestedDate, requestedTimezone)
  );
}

function mergeLiveIntoFixture<TFixture extends Record<string, any>>(
  baseFixture: TFixture,
  liveFixture: FootballLiveHomeFixture
): TFixture {
  return {
    ...baseFixture,
    fixture: {
      ...baseFixture.fixture,
      status: {
        ...baseFixture.fixture?.status,
        ...(liveFixture.fixture.status?.short
          ? { short: liveFixture.fixture.status.short }
          : {}),
        ...(liveFixture.fixture.status?.elapsed !== undefined
          ? { elapsed: liveFixture.fixture.status.elapsed ?? null }
          : {}),
      },
    },
    goals: {
      ...baseFixture.goals,
      ...(liveFixture.goals?.home !== undefined
        ? { home: liveFixture.goals.home ?? null }
        : {}),
      ...(liveFixture.goals?.away !== undefined
        ? { away: liveFixture.goals.away ?? null }
        : {}),
    },
    score: {
      ...baseFixture.score,
      fulltime: {
        ...baseFixture.score?.fulltime,
        ...(liveFixture.goals?.home !== undefined
          ? { home: liveFixture.goals.home ?? null }
          : {}),
        ...(liveFixture.goals?.away !== undefined
          ? { away: liveFixture.goals.away ?? null }
          : {}),
      },
    },
    ...(Array.isArray(liveFixture.events) && liveFixture.events.length > 0
      ? { events: liveFixture.events }
      : {}),
  };
}

const LIVE_STATUS_SHORTS = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"]);

function matchStateKey(fixtureId: number) {
  return `match_state:${fixtureId}`;
}

function parseStoredState(raw: string | null): StoredMatchState | null {
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredMatchState;
  } catch {
    return null;
  }
}

function buildAnchorFromStoredState(
  state: StoredMatchState | null,
  serverNowMs: number
): FootballLiveClockAnchor | null {
  if (!state || !isLiveFixtureItem(state.fixture as ApiFootballFixtureItem)) {
    return null;
  }

  const elapsed = state.fixture?.fixture?.status?.elapsed;
  if (typeof elapsed !== "number" || !Number.isFinite(elapsed) || elapsed < 0) {
    return null;
  }

  if (!Number.isFinite(state.updatedAtMs) || state.updatedAtMs <= 0) {
    return null;
  }

  return {
    elapsed,
    anchoredAtMs: state.updatedAtMs,
    serverNowMs,
    source: "match_state",
  };
}

async function getFootballLiveClockAnchors(
  fixtureIds: number[],
  serverNowMs = Date.now()
): Promise<Map<number, FootballLiveClockAnchor>> {
  const uniqueIds = Array.from(
    new Set(
      fixtureIds.filter(
        (fixtureId): fixtureId is number =>
          typeof fixtureId === "number" && Number.isFinite(fixtureId) && fixtureId > 0
      )
    )
  );

  if (!uniqueIds.length) {
    return new Map();
  }

  const anchors = new Map<number, FootballLiveClockAnchor>();

  try {
    const rawStates = await redisConnection.mget(...uniqueIds.map(matchStateKey));

    uniqueIds.forEach((fixtureId, index) => {
      const anchor = buildAnchorFromStoredState(
        parseStoredState(rawStates[index] ?? null),
        serverNowMs
      );

      if (anchor) {
        anchors.set(fixtureId, anchor);
      }
    });
  } catch {
    // Redis read failures fall back to snapshot lookup below.
  }

  if (anchors.size === uniqueIds.length) {
    return anchors;
  }

  const snapshot = await getFootballLiveSnapshot();
  if (!snapshot?.response?.length) {
    return anchors;
  }

  const snapshotAnchoredAtMs = Date.parse(snapshot.updatedAt);
  if (!Number.isFinite(snapshotAnchoredAtMs) || snapshotAnchoredAtMs <= 0) {
    return anchors;
  }

  for (const fixture of snapshot.response) {
    const fixtureId = fixture?.fixture?.id;
    if (typeof fixtureId !== "number" || anchors.has(fixtureId)) {
      continue;
    }

    const statusShort = fixture.fixture?.status?.short;
    const elapsed = fixture.fixture?.status?.elapsed;

    if (!LIVE_STATUS_SHORTS.has(statusShort ?? "")) {
      continue;
    }

    if (typeof elapsed !== "number" || !Number.isFinite(elapsed) || elapsed < 0) {
      continue;
    }

    anchors.set(fixtureId, {
      elapsed,
      anchoredAtMs: snapshotAnchoredAtMs,
      serverNowMs,
      source: "snapshot",
    });
  }

  return anchors;
}

function isLiveFixtureItem(fixture: ApiFootballFixtureItem) {
  return LIVE_STATUS_SHORTS.has(fixture?.fixture?.status?.short ?? "");
}

async function attachClockAnchorsToFixtures(fixtures: ApiFootballFixtureItem[]) {
  const liveFixtureIds = Array.from(
    new Set(
      fixtures
        .filter(isLiveFixtureItem)
        .map((fixture) => fixture?.fixture?.id)
        .filter((fixtureId): fixtureId is number => typeof fixtureId === "number")
    )
  );

  if (!liveFixtureIds.length) {
    return fixtures;
  }

  const anchors = await getFootballLiveClockAnchors(liveFixtureIds, Date.now());
  if (!anchors.size) {
    return fixtures;
  }

  return fixtures.map((fixture) => {
    const fixtureId = fixture?.fixture?.id;
    if (typeof fixtureId !== "number") {
      return fixture;
    }

    const clockAnchor = anchors.get(fixtureId);
    if (!clockAnchor) {
      return fixture;
    }

    return {
      ...fixture,
      fixture: {
        ...fixture.fixture,
        clockAnchor,
      },
    };
  });
}

function parseOptionalInteger(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw createFootballValidationError(
      `El parametro ${field} debe ser un numero entero`
    );
  }

  return parsed;
}

function parseRequiredInteger(value: unknown, field: string) {
  const parsed = parseOptionalInteger(value, field);
  if (parsed === undefined) {
    throw createFootballValidationError(`El parametro ${field} es obligatorio`);
  }

  return parsed;
}

function parseOptionalBoolean(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (value === true || value === "true") {
    return true;
  }

  if (value === false || value === "false") {
    return false;
  }

  throw createFootballValidationError(
    `El parametro ${field} debe ser true o false`
  );
}

function toLeaguesQuery(query: Record<string, unknown>): GetLeaguesQuery {
  return {
    id: parseOptionalInteger(query.id, "id"),
    name: typeof query.name === "string" ? query.name : undefined,
    code: typeof query.code === "string" ? query.code : undefined,
    search: typeof query.search === "string" ? query.search : undefined,
    country: typeof query.country === "string" ? query.country : undefined,
    season: parseOptionalInteger(query.season, "season"),
    current: parseOptionalBoolean(query.current, "current"),
    team: parseOptionalInteger(query.team, "team"),
    type: typeof query.type === "string" ? query.type : undefined,
    last: parseOptionalInteger(query.last, "last"),
  };
}

function toFixturesQuery(query: Record<string, unknown>): GetFixturesQuery {
  return {
    id: parseOptionalInteger(query.id, "id"),
    ids: typeof query.ids === "string" ? query.ids : undefined,
    league: parseOptionalInteger(query.league, "league"),
    season: parseOptionalInteger(query.season, "season"),
    team: parseOptionalInteger(query.team, "team"),
    live: typeof query.live === "string" ? query.live : undefined,
    date: typeof query.date === "string" ? query.date : undefined,
    from: typeof query.from === "string" ? query.from : undefined,
    to: typeof query.to === "string" ? query.to : undefined,
    next: parseOptionalInteger(query.next, "next"),
    last: parseOptionalInteger(query.last, "last"),
    round: typeof query.round === "string" ? query.round : undefined,
    status: typeof query.status === "string" ? query.status : undefined,
    venue: parseOptionalInteger(query.venue, "venue"),
  };
}

function toTeamsQuery(query: Record<string, unknown>): GetTeamsQuery {
  return {
    id: parseOptionalInteger(query.id, "id"),
    name: typeof query.name === "string" ? query.name : undefined,
    league: parseOptionalInteger(query.league, "league"),
    season: parseOptionalInteger(query.season, "season"),
    country: typeof query.country === "string" ? query.country : undefined,
    code: typeof query.code === "string" ? query.code : undefined,
    venue: parseOptionalInteger(query.venue, "venue"),
    search: typeof query.search === "string" ? query.search : undefined,
  };
}

function toTeamStatisticsQuery(query: Record<string, unknown>): GetTeamStatisticsQuery {
  return {
    league: parseRequiredInteger(query.league, "league"),
    season: parseRequiredInteger(query.season, "season"),
    team: parseRequiredInteger(query.team, "team"),
    date: typeof query.date === "string" ? query.date : undefined,
  };
}

function toVenuesQuery(query: Record<string, unknown>): GetVenuesQuery {
  return {
    id: parseOptionalInteger(query.id, "id"),
    name: typeof query.name === "string" ? query.name : undefined,
    city: typeof query.city === "string" ? query.city : undefined,
    country: typeof query.country === "string" ? query.country : undefined,
    search: typeof query.search === "string" ? query.search : undefined,
  };
}

function toStandingsQuery(query: Record<string, unknown>): GetStandingsQuery {
  return {
    league: parseOptionalInteger(query.league, "league"),
    season: parseRequiredInteger(query.season, "season"),
    team: parseOptionalInteger(query.team, "team"),
  };
}

function toInjuriesQuery(query: Record<string, unknown>): GetInjuriesQuery {
  return {
    league: parseOptionalInteger(query.league, "league"),
    season: parseOptionalInteger(query.season, "season"),
    fixture: parseOptionalInteger(query.fixture, "fixture"),
    team: parseOptionalInteger(query.team, "team"),
    player: parseOptionalInteger(query.player, "player"),
    date: typeof query.date === "string" ? query.date : undefined,
    ids: typeof query.ids === "string" ? query.ids : undefined,
  };
}

function toCoachsQuery(query: Record<string, unknown>) {
  return {
    id: parseOptionalInteger(query.id, "id"),
    team: parseOptionalInteger(query.team, "team"),
    search: typeof query.search === "string" ? query.search : undefined,
  };
}

function toPlayersQuery(query: Record<string, unknown>): GetPlayersQuery {
  return {
    id: parseOptionalInteger(query.id, "id"),
    team: parseOptionalInteger(query.team, "team"),
    league: parseOptionalInteger(query.league, "league"),
    season: parseOptionalInteger(query.season, "season"),
    search: typeof query.search === "string" ? query.search : undefined,
    page: parseOptionalInteger(query.page, "page"),
  };
}

function toTopPlayersQuery(query: Record<string, unknown>): GetTopPlayersQuery {
  return {
    league: parseRequiredInteger(query.league, "league"),
    season: parseRequiredInteger(query.season, "season"),
  };
}

function toTransfersQuery(query: Record<string, unknown>): GetTransfersQuery {
  return {
    player: parseOptionalInteger(query.player, "player"),
    team: parseOptionalInteger(query.team, "team"),
  };
}

function toTrophiesQuery(query: Record<string, unknown>): GetTrophiesQuery {
  return {
    player: parseOptionalInteger(query.player, "player"),
    players: typeof query.players === "string" ? query.players : undefined,
    coach: parseOptionalInteger(query.coach, "coach"),
    coachs: typeof query.coachs === "string" ? query.coachs : undefined,
  };
}

function toSidelinedQuery(query: Record<string, unknown>): GetSidelinedQuery {
  return {
    player: parseOptionalInteger(query.player, "player"),
    players: typeof query.players === "string" ? query.players : undefined,
    coach: parseOptionalInteger(query.coach, "coach"),
    coachs: typeof query.coachs === "string" ? query.coachs : undefined,
  };
}

function toOddsLiveQuery(query: Record<string, unknown>): GetOddsLiveQuery {
  return {
    fixture: parseOptionalInteger(query.fixture, "fixture"),
    league: parseOptionalInteger(query.league, "league"),
    bet: parseOptionalInteger(query.bet, "bet"),
  };
}

function toOddsLiveBetsQuery(query: Record<string, unknown>): GetOddsLiveBetsQuery {
  return {
    id: parseOptionalInteger(query.id, "id"),
    search: typeof query.search === "string" ? query.search : undefined,
  };
}

function toOddsQuery(query: Record<string, unknown>): GetOddsQuery {
  return {
    fixture: parseOptionalInteger(query.fixture, "fixture"),
    league: parseOptionalInteger(query.league, "league"),
    season: parseOptionalInteger(query.season, "season"),
    date: typeof query.date === "string" ? query.date : undefined,
    timezone: typeof query.timezone === "string" && query.timezone.trim() ? query.timezone.trim() : undefined,
    page: parseOptionalInteger(query.page, "page"),
    bookmaker: parseOptionalInteger(query.bookmaker, "bookmaker"),
    bet: parseOptionalInteger(query.bet, "bet"),
  };
}

function isTruthyQueryFlag(value: unknown) {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function parseFixtureIds(value: unknown): number[] {
  if (typeof value !== "string") return [];

  return Array.from(
    new Set(
      value
        .split("-")
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item) && item > 0)
    )
  );
}

function parseOddsFixtureIdsFromQuery(query: Record<string, unknown>): number[] {
  return [
    ...parseFixtureIds(query.fixtures),
    ...(typeof query.fixture === "string"
      ? [parseOptionalInteger(query.fixture, "fixture")].filter(
          (fixtureId): fixtureId is number => typeof fixtureId === "number"
        )
      : []),
  ];
}

async function getCachedOddsResponse(query: Record<string, unknown>) {
  const fixtureIds = parseOddsFixtureIdsFromQuery(query);
  const date = typeof query.date === "string" ? query.date : undefined;
  const bookmaker =
    parseOptionalInteger(query.bookmaker, "bookmaker") ?? DEFAULT_ODDS_BOOKMAKER;
  const bet = parseOptionalInteger(query.bet, "bet") ?? DEFAULT_ODDS_BET;

  return getCachedPrematchOddsResponse(fixtureIds, bookmaker, bet, date);
}

async function getHydrateOddsResponse(query: Record<string, unknown>) {
  const fixtureIds = parseOddsFixtureIdsFromQuery(query);
  const date = typeof query.date === "string" ? query.date : undefined;
  const timezone =
    typeof query.timezone === "string" && query.timezone.trim()
      ? query.timezone.trim()
      : "UTC";

  if (!fixtureIds.length && !date) {
    throw createFootballValidationError(
      "Para hydrateMissing se requiere el parametro date o fixture(s)"
    );
  }
  const bookmaker =
    parseOptionalInteger(query.bookmaker, "bookmaker") ?? DEFAULT_ODDS_BOOKMAKER;
  const bet = parseOptionalInteger(query.bet, "bet") ?? DEFAULT_ODDS_BET;
  return hydrateFixturesOddsResponse(fixtureIds, bookmaker, bet, { date, timezone });
}

function toOddsMappingQuery(query: Record<string, unknown>): GetOddsMappingQuery {
  return {
    page: parseOptionalInteger(query.page, "page"),
  };
}

function toOddsBookmakersQuery(
  query: Record<string, unknown>
): GetOddsBookmakersQuery {
  return {
    id: parseOptionalInteger(query.id, "id"),
    search: typeof query.search === "string" ? query.search : undefined,
  };
}

function toOddsBetsQuery(query: Record<string, unknown>): GetOddsBetsQuery {
  return {
    id: typeof query.id === "string" ? query.id : undefined,
    search: typeof query.search === "string" ? query.search : undefined,
  };
}

function handleFootballError(
  set: { status?: number | string; headers?: Record<string, unknown> },
  error: unknown
) {
  if (error instanceof FootballModuleError) {
    set.status = error.status;
    if (
      error.code === "FIXTURE_TIMEOUT_COOLDOWN" &&
      typeof error.details?.retryAfterSeconds === "number"
    ) {
      set.headers = set.headers ?? {};
      set.headers["Retry-After"] = String(error.details.retryAfterSeconds);
    }

    return {
      error: error.message,
      code: error.code,
      ...(error.details ? error.details : {}),
    };
  }

  set.status = 500;
  return { error: "Error interno del servidor", code: "INTERNAL_ERROR" };
}

function footballDetail(summary: string, example: unknown, description?: string) {
  return createSwaggerDetail("Football", summary, example, description);
}

function encodeSseEvent(event: string, payload: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export function createFootballRoutes(service: FootballServiceContract = footballService) {
  return new Elysia({ prefix: "/football" })
    .get("/live/home", async ({ query, set }) => {
      try {
        const date =
          typeof query.date === "string" && query.date.trim().length > 0
            ? query.date.trim()
            : undefined;
        const timezone =
          typeof query.timezone === "string" && query.timezone.trim().length > 0
            ? query.timezone.trim()
            : "America/Argentina/Buenos_Aires";

        if (!date) {
          throw createFootballValidationError("El parametro date es obligatorio");
        }

        const [baseEnvelope, snapshot] = await Promise.all([
          service.getFixtures({ date, timezone }),
          getFootballLiveSnapshot(),
        ]);

        const liveFixtures = Array.isArray(snapshot?.response) ? snapshot.response : [];
        const baseResponse = filterFixturesByRequestedDate(
          Array.isArray(baseEnvelope.response) ? baseEnvelope.response : [],
          date,
          timezone
        );
        const mergedMap = new Map<number, Record<string, any>>(
          baseResponse
            .filter((fixture) => Boolean(fixture?.fixture?.id))
            .map((fixture) => [fixture.fixture.id as number, fixture])
        );

        if (snapshot) {
          logInfo("football.live_home.snapshot_hit", {
            date,
            timezone,
            results: liveFixtures.length,
            version: snapshot.version,
          });
        } else {
          logWarn("football.live_home.snapshot_missing", { date, timezone });
        }

        logInfo("football.live_home.base_fetch_hit", {
          date,
          timezone,
          results: baseResponse.length,
        });

        const missingLiveIds = liveFixtures
          .map((fixture) => fixture?.fixture?.id)
          .filter(
            (fixtureId): fixtureId is number =>
              typeof fixtureId === "number" && !mergedMap.has(fixtureId)
          );

        if (missingLiveIds.length > 0) {
          const missingEnvelope = await service.getFixtures({
            ids: missingLiveIds.join("-"),
            timezone,
          });
          const missingResponse = filterFixturesByRequestedDate(
            Array.isArray(missingEnvelope.response) ? missingEnvelope.response : [],
            date,
            timezone
          );

          for (const fixture of missingResponse) {
            if (
              fixture?.fixture?.id &&
              fixtureBelongsToRequestedDate(fixture as Record<string, any>, date, timezone)
            ) {
              mergedMap.set(fixture.fixture.id, fixture as Record<string, any>);
            }
          }
        }

        for (const liveFixture of liveFixtures) {
          const fixtureId = liveFixture?.fixture?.id;
          if (typeof fixtureId !== "number") continue;

          const baseFixture = mergedMap.get(fixtureId);
        if (!baseFixture) continue;

        if (shouldApplyLiveOverlay(baseFixture, liveFixture)) {
          mergedMap.set(fixtureId, mergeLiveIntoFixture(baseFixture, liveFixture));
        } else if (
          Array.isArray(liveFixture.events) &&
          liveFixture.events.length > 0 &&
          (!Array.isArray(baseFixture.events) || baseFixture.events.length === 0)
        ) {
          // Match is no longer live in base data but snapshot still has events
          // (brief window between FT and snapshot expiry) — apply events only.
          mergedMap.set(fixtureId, { ...baseFixture, events: liveFixture.events });
        }
      }

        // For finished fixtures that have no events in the base data, hydrate from
        // the per-fixture events cache written by the live poller (6h TTL).
        const TERMINAL_STATUSES = new Set(["FT", "AET", "PEN", "AWD", "WO"]);
        const fixturesNeedingEvents = Array.from(mergedMap.values()).filter((f) => {
          const status = f?.fixture?.status?.short;
          return (
            TERMINAL_STATUSES.has(status) &&
            (!Array.isArray(f.events) || f.events.length === 0)
          );
        });

        if (fixturesNeedingEvents.length > 0) {
          const ids = fixturesNeedingEvents
            .map((f) => f?.fixture?.id)
            .filter((id): id is number => typeof id === "number");
          const eventsMap = await getFixtureEventsMap(ids);
          for (const [fixtureId, events] of eventsMap) {
            const base = mergedMap.get(fixtureId);
            if (base) mergedMap.set(fixtureId, { ...base, events });
          }
        }

        const mergedResponse = Array.from(mergedMap.values()).sort((left, right) => {
          const leftTs = Number(left?.fixture?.timestamp ?? 0);
          const rightTs = Number(right?.fixture?.timestamp ?? 0);
          return leftTs - rightTs;
        });

        logInfo("football.live_home.merge_results", {
          date,
          timezone,
          baseResults: baseResponse.length,
          liveResults: liveFixtures.length,
          missingLiveIds: missingLiveIds.length,
          mergedResults: mergedResponse.length,
        });

        set.headers["Cache-Control"] = "public, max-age=15, stale-while-revalidate=30";
        return {
          source: "redis+base",
          date,
          timezone,
          updatedAt: snapshot?.updatedAt ?? new Date().toISOString(),
          results: mergedResponse.length,
          response: mergedResponse,
        };
      } catch (error) {
        return handleFootballError(set, error);
      }
    }, {
      detail: footballDetail(
        "Obtener panel live home de football",
        footballSwaggerExamples.fixtures,
        "Retorna el merge entre fixtures base y snapshot live para poblar la home en vivo."
      ),
    })
    .get("/live/stream", ({ request, set }) => {
      set.headers["Content-Type"] = "text/event-stream; charset=utf-8";
      set.headers["Cache-Control"] = "no-cache, no-transform";
      set.headers["Connection"] = "keep-alive";
      set.headers["X-Accel-Buffering"] = "no";

      const encoder = new TextEncoder();

      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            let closed = false;
            let lastVersion = "";
            let lastKeepaliveAt = 0;
            let isTickRunning = false;
            let intervalId: ReturnType<typeof setInterval> | null = null;

            const close = () => {
              if (closed) return;
              closed = true;
              if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
              }
              request.signal.removeEventListener("abort", close);
              controller.close();
            };

            const enqueue = (chunk: string) => {
              if (closed) return;
              controller.enqueue(encoder.encode(chunk));
            };

            const pushSnapshot = async (force = false) => {
              const snapshot =
                (await getFootballLiveSnapshot()) ?? createEmptyFootballLiveSnapshot();

              if (!force && snapshot.version === lastVersion) {
                return;
              }

              lastVersion = snapshot.version;
              if (snapshot.results === 0) {
                logInfo("football.live_stream.snapshot_empty", {
                  version: snapshot.version,
                  updatedAt: snapshot.updatedAt,
                });
              } else {
                logInfo("football.live_stream.snapshot_push", {
                  version: snapshot.version,
                  updatedAt: snapshot.updatedAt,
                  results: snapshot.results,
                  force,
                });
              }
              enqueue(encodeSseEvent("snapshot", snapshot));
            };

            const tick = async () => {
              if (closed || isTickRunning) return;
              isTickRunning = true;

              try {
                await pushSnapshot(false);

                const now = Date.now();
                if (now - lastKeepaliveAt >= FOOTBALL_LIVE_STREAM_KEEPALIVE_MS) {
                  lastKeepaliveAt = now;
                  enqueue(`: keepalive ${new Date(now).toISOString()}\n\n`);
                }
              } catch (_error) {
                enqueue(
                  encodeSseEvent("error", {
                    message: "No se pudo leer el snapshot live desde Redis",
                  })
                );
              } finally {
                isTickRunning = false;
              }
            };

            request.signal.addEventListener("abort", close);

            enqueue(
              encodeSseEvent("connected", {
                connectedAt: new Date().toISOString(),
                source: "redis",
              })
            );

            void pushSnapshot(true);
            intervalId = setInterval(() => {
              void tick();
            }, FOOTBALL_LIVE_STREAM_POLL_MS);
          },
          cancel() {},
        }),
        {
          headers: set.headers as HeadersInit,
        }
      );
    }, {
      detail: {
        tags: ["Football"],
        summary: "Obtener stream live de football",
        description: "Stream SSE del snapshot live de football.",
      },
    })
    .get(
      "/countries",
      async ({ query, set }) => {
        try {
          return await service.getCountries(query as GetCountriesQuery);
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail("Obtener paises disponibles", footballSwaggerExamples.countries),
        query: countriesQuerySchema,
      }
    )
    .get(
      "/timezone",
      async ({ set }) => {
        try {
          return await service.getTimezone();
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail(
          "Obtener zonas horarias disponibles",
          footballSwaggerExamples.timezone
        ),
      }
    )
    .get(
      "/leagues",
      async ({ query, set }) => {
        try {
          return await service.getLeagues(toLeaguesQuery(query as Record<string, unknown>));
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail("Obtener ligas", footballSwaggerExamples.leagues),
        query: leaguesQuerySchema,
      }
    )
    .get(
      "/leagues/seasons",
      async ({ set }) => {
        try {
          return await service.getLeagueSeasons();
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail(
          "Obtener temporadas disponibles",
          footballSwaggerExamples.leagueSeasons
        ),
      }
    )
    .get(
      "/fixtures",
      async ({ query, set }) => {
        try {
          const parsedQuery = toFixturesQuery(query as Record<string, unknown>);
          const envelope = await service.getFixtures(parsedQuery);

          if (!Array.isArray(envelope.response) || envelope.response.length === 0) {
            return envelope;
          }

          // When fetching by id/ids, merge with live snapshot so elapsed/goals/status
          // are always from the latest poll (same source as /live/home).
          const isSingleLookup = parsedQuery.id != null || parsedQuery.ids != null;
          let fixtures = envelope.response as ApiFootballFixtureItem[];

          if (parsedQuery.date) {
            const requestedTz =
              typeof parsedQuery.timezone === "string" && parsedQuery.timezone.trim().length > 0
                ? parsedQuery.timezone
                : "America/Argentina/Buenos_Aires";
            fixtures = filterFixturesByRequestedDate(fixtures, parsedQuery.date, requestedTz);
          }

          if (isSingleLookup) {
            const snapshot = await getFootballLiveSnapshot();
            if (snapshot?.response?.length) {
              const liveMap = new Map<number, (typeof snapshot.response)[number]>();
              for (const lf of snapshot.response) {
                if (lf?.fixture?.id) liveMap.set(lf.fixture.id, lf);
              }
              fixtures = fixtures.map((base) => {
                const lf = liveMap.get(base?.fixture?.id as number);
                return lf ? (mergeLiveIntoFixture(base, lf) as ApiFootballFixtureItem) : base;
              });
            }
          }

          const response = await attachClockAnchorsToFixtures(fixtures);

          if (isSingleLookup) {
            // Live match view — never cache, always return fresh elapsed/clock data.
            set.headers["Cache-Control"] = "no-store";
          } else if (response === fixtures && fixtures.length === envelope.response.length) {
            return envelope;
          }

          return {
            ...envelope,
            response,
          };
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail("Obtener fixtures", footballSwaggerExamples.fixtures),
        query: fixturesQuerySchema,
      }
    )
    .get(
      "/fixtures/rounds",
      async ({ query, set }) => {
        try {
          return await service.getFixtureRounds({
            league: parseRequiredInteger(query.league, "league"),
            season: parseRequiredInteger(query.season, "season"),
            current: parseOptionalBoolean(query.current, "current"),
            dates: typeof query.dates === "string" ? query.dates : undefined,
          } satisfies GetFixtureRoundsQuery);
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail(
          "Obtener rondas de fixtures",
          footballSwaggerExamples.fixtureRounds
        ),
        query: fixtureRoundsQuerySchema,
      }
    )
    .get(
      "/fixtures/headtohead",
      async ({ query, set }) => {
        try {
          return await service.getFixtureHeadToHead({
            h2h: typeof query.h2h === "string" ? query.h2h : "",
            league: parseOptionalInteger(query.league, "league"),
            season: parseOptionalInteger(query.season, "season"),
            date: typeof query.date === "string" ? query.date : undefined,
            from: typeof query.from === "string" ? query.from : undefined,
            to: typeof query.to === "string" ? query.to : undefined,
            next: parseOptionalInteger(query.next, "next"),
            last: parseOptionalInteger(query.last, "last"),
            status: typeof query.status === "string" ? query.status : undefined,
            venue: parseOptionalInteger(query.venue, "venue"),
          } satisfies GetFixtureHeadToHeadQuery);
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail(
          "Obtener historial head to head",
          footballSwaggerExamples.fixtureHeadToHead
        ),
        query: fixtureHeadToHeadQuerySchema,
      }
    )
    .get(
      "/fixtures/statistics",
      async ({ query, set }) => {
        try {
          return await service.getFixtureStatistics({
            fixture: parseRequiredInteger(query.fixture, "fixture"),
            team: parseOptionalInteger(query.team, "team"),
            type: typeof query.type === "string" ? query.type : undefined,
            half: typeof query.half === "string" ? query.half : undefined,
          } satisfies GetFixtureStatisticsQuery);
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail(
          "Obtener estadisticas de fixture",
          footballSwaggerExamples.fixtureStatistics
        ),
        query: fixtureStatisticsQuerySchema,
      }
    )
    .get(
      "/fixtures/events",
      async ({ query, set }) => {
        try {
          return await service.getFixtureEvents({
            fixture: parseRequiredInteger(query.fixture, "fixture"),
            team: parseOptionalInteger(query.team, "team"),
            player: parseOptionalInteger(query.player, "player"),
            type: typeof query.type === "string" ? query.type : undefined,
          } satisfies GetFixtureEventsQuery);
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail(
          "Obtener eventos de fixture",
          footballSwaggerExamples.fixtureEvents
        ),
        query: fixtureEventsQuerySchema,
      }
    )
    .get(
      "/fixtures/lineups",
      async ({ query, set }) => {
        try {
          return await service.getFixtureLineups({
            fixture: parseRequiredInteger(query.fixture, "fixture"),
            team: parseOptionalInteger(query.team, "team"),
            player: parseOptionalInteger(query.player, "player"),
            type: typeof query.type === "string" ? query.type : undefined,
          } satisfies GetFixtureLineupsQuery);
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail(
          "Obtener alineaciones de fixture",
          footballSwaggerExamples.fixtureLineups
        ),
        query: fixtureLineupsQuerySchema,
      }
    )
    .get(
      "/fixtures/players",
      async ({ query, set }) => {
        try {
          return await service.getFixturePlayers({
            fixture: parseRequiredInteger(query.fixture, "fixture"),
            team: parseOptionalInteger(query.team, "team"),
          } satisfies GetFixturePlayersQuery);
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail(
          "Obtener jugadores de fixture",
          footballSwaggerExamples.fixturePlayers
        ),
        query: fixturePlayersQuerySchema,
      }
    )
    .get(
      "/teams",
      async ({ query, set }) => {
        try {
          return await service.getTeams(toTeamsQuery(query as Record<string, unknown>));
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail("Obtener equipos", footballSwaggerExamples.teams),
        query: teamsQuerySchema,
      }
    )
    .get(
      "/teams/statistics",
      async ({ query, set }) => {
        try {
          return await service.getTeamStatistics(
            toTeamStatisticsQuery(query as Record<string, unknown>)
          );
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail(
          "Obtener estadisticas de equipo",
          footballSwaggerExamples.teamStatistics
        ),
        query: teamStatisticsQuerySchema,
      }
    )
    .get(
      "/teams/seasons",
      async ({ query, set }) => {
        try {
          return await service.getTeamSeasons({
            team: parseRequiredInteger(query.team, "team"),
          } satisfies GetTeamSeasonsQuery);
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail(
          "Obtener temporadas de un equipo",
          footballSwaggerExamples.teamSeasons
        ),
        query: teamSeasonsQuerySchema,
      }
    )
    .get(
      "/teams/countries",
      async ({ set }) => {
        try {
          return await service.getTeamCountries();
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail(
          "Obtener paises de equipos",
          footballSwaggerExamples.teamCountries
        ),
      }
    )
    .get(
      "/venues",
      async ({ query, set }) => {
        try {
          return await service.getVenues(toVenuesQuery(query as Record<string, unknown>));
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail("Obtener estadios", footballSwaggerExamples.venues),
        query: venuesQuerySchema,
      }
    )
    .get(
      "/standings",
      async ({ query, set }) => {
        try {
          return await service.getStandings(toStandingsQuery(query as Record<string, unknown>));
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail("Obtener posiciones", footballSwaggerExamples.standings),
        query: standingsQuerySchema,
      }
    )
    .get(
      "/injuries",
      async ({ query, set }) => {
        try {
          return await service.getInjuries(toInjuriesQuery(query as Record<string, unknown>));
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail("Obtener lesiones", footballSwaggerExamples.injuries),
        query: injuriesQuerySchema,
      }
    )
    .get(
      "/predictions",
      async ({ query, set }) => {
        try {
          return await service.getPredictions({
            fixture: parseRequiredInteger(query.fixture, "fixture"),
          } satisfies GetPredictionsQuery);
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail(
          "Obtener predicciones de un fixture",
          footballSwaggerExamples.predictions
        ),
        query: predictionsQuerySchema,
      }
    )
    .get(
      "/coachs",
      async ({ query, set }) => {
        try {
          return await service.getCoachs(toCoachsQuery(query as Record<string, unknown>));
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail("Obtener entrenadores", footballSwaggerExamples.coachs),
        query: coachsQuerySchema,
      }
    )
    .get(
      "/players/seasons",
      async ({ set }) => {
        try {
          return await service.getPlayersSeasons();
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail(
          "Obtener temporadas de jugadores",
          footballSwaggerExamples.playersSeasons
        ),
      }
    )
    .get(
      "/players/profiles",
      async ({ query, set }) => {
        try {
          return await service.getPlayerProfiles({
            player: parseRequiredInteger(query.player, "player"),
          } satisfies GetPlayerProfilesQuery);
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail(
          "Obtener perfiles de jugador",
          footballSwaggerExamples.playerProfiles
        ),
        query: playerProfilesQuerySchema,
      }
    )
    .get(
      "/players",
      async ({ query, set }) => {
        try {
          return await service.getPlayers(toPlayersQuery(query as Record<string, unknown>));
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail("Obtener jugadores", footballSwaggerExamples.players),
        query: playersQuerySchema,
      }
    )
    .get(
      "/players/squads",
      async ({ query, set }) => {
        try {
          return await service.getPlayerSquads({
            team: parseOptionalInteger(query.team, "team"),
            player: parseOptionalInteger(query.player, "player"),
          } satisfies GetPlayerSquadsQuery);
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail(
          "Obtener squads de jugadores",
          footballSwaggerExamples.playerSquads
        ),
        query: playerSquadsQuerySchema,
      }
    )
    .get(
      "/players/teams",
      async ({ query, set }) => {
        try {
          return await service.getPlayerTeams({
            player: parseRequiredInteger(query.player, "player"),
          } satisfies GetPlayerTeamsQuery);
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail(
          "Obtener equipos por jugador",
          footballSwaggerExamples.playerTeams
        ),
        query: playerTeamsQuerySchema,
      }
    )
    .get(
      "/players/topscorers",
      async ({ query, set }) => {
        try {
          return await service.getPlayersTopScorers(
            toTopPlayersQuery(query as Record<string, unknown>)
          );
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail(
          "Obtener maximos goleadores",
          footballSwaggerExamples.topPlayers
        ),
        query: topPlayersQuerySchema,
      }
    )
    .get(
      "/players/topassists",
      async ({ query, set }) => {
        try {
          return await service.getPlayersTopAssists(
            toTopPlayersQuery(query as Record<string, unknown>)
          );
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail(
          "Obtener maximos asistentes",
          footballSwaggerExamples.topPlayers
        ),
        query: topPlayersQuerySchema,
      }
    )
    .get(
      "/players/topyellowcards",
      async ({ query, set }) => {
        try {
          return await service.getPlayersTopYellowCards(
            toTopPlayersQuery(query as Record<string, unknown>)
          );
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail(
          "Obtener jugadores con mas amarillas",
          footballSwaggerExamples.topPlayers
        ),
        query: topPlayersQuerySchema,
      }
    )
    .get(
      "/players/topredcards",
      async ({ query, set }) => {
        try {
          return await service.getPlayersTopRedCards(
            toTopPlayersQuery(query as Record<string, unknown>)
          );
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail(
          "Obtener jugadores con mas rojas",
          footballSwaggerExamples.topPlayers
        ),
        query: topPlayersQuerySchema,
      }
    )
    .get(
      "/transfers",
      async ({ query, set }) => {
        try {
          return await service.getTransfers(toTransfersQuery(query as Record<string, unknown>));
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail("Obtener transferencias", footballSwaggerExamples.transfers),
        query: transfersQuerySchema,
      }
    )
    .get(
      "/trophies",
      async ({ query, set }) => {
        try {
          return await service.getTrophies(toTrophiesQuery(query as Record<string, unknown>));
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail("Obtener trofeos", footballSwaggerExamples.trophies),
        query: trophiesQuerySchema,
      }
    )
    .get(
      "/sidelined",
      async ({ query, set }) => {
        try {
          return await service.getSidelined(toSidelinedQuery(query as Record<string, unknown>));
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail(
          "Obtener historial de ausencias",
          footballSwaggerExamples.sidelined
        ),
        query: sidelinedQuerySchema,
      }
    )
    .get(
      "/odds/live",
      async ({ query, set }) => {
        try {
          return await service.getOddsLive(toOddsLiveQuery(query as Record<string, unknown>));
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail("Obtener cuotas en vivo", footballSwaggerExamples.oddsLive),
        query: oddsLiveQuerySchema,
      }
    )
    .get(
      "/odds/live/bets",
      async ({ query, set }) => {
        try {
          return await service.getOddsLiveBets(
            toOddsLiveBetsQuery(query as Record<string, unknown>)
          );
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail(
          "Obtener tipos de apuesta en vivo",
          footballSwaggerExamples.oddsLiveBets
        ),
        query: oddsLiveBetsQuerySchema,
      }
    )
    .get(
      "/odds",
      async ({ query, set }) => {
        try {
          if (isTruthyQueryFlag((query as Record<string, unknown>).hydrateMissing)) {
            return await getHydrateOddsResponse(query as Record<string, unknown>);
          }
          if (isTruthyQueryFlag((query as Record<string, unknown>).cacheOnly)) {
            return await getCachedOddsResponse(query as Record<string, unknown>);
          }
          return await service.getOdds(toOddsQuery(query as Record<string, unknown>));
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail("Obtener cuotas pre-partido", footballSwaggerExamples.odds),
        query: oddsQuerySchema,
      }
    )
    .get(
      "/odds/mapping",
      async ({ query, set }) => {
        try {
          return await service.getOddsMapping(
            toOddsMappingQuery(query as Record<string, unknown>)
          );
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail(
          "Obtener mapping de cuotas",
          footballSwaggerExamples.oddsMapping
        ),
        query: oddsMappingQuerySchema,
      }
    )
    .get(
      "/odds/bookmakers",
      async ({ query, set }) => {
        try {
          return await service.getOddsBookmakers(
            toOddsBookmakersQuery(query as Record<string, unknown>)
          );
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail(
          "Obtener bookmakers",
          footballSwaggerExamples.oddsBookmakers
        ),
        query: oddsBookmakersQuerySchema,
      }
    )
    .get(
      "/odds/bets",
      async ({ query, set }) => {
        try {
          return await service.getOddsBets(toOddsBetsQuery(query as Record<string, unknown>));
        } catch (error) {
          return handleFootballError(set, error);
        }
      },
      {
        detail: footballDetail(
          "Obtener tipos de apuesta pre-partido",
          footballSwaggerExamples.oddsBets
        ),
        query: oddsBetsQuerySchema,
      }
    )
    .onError(({ error, set }) => handleFootballError(set, error));
}

export const footballRoutes = createFootballRoutes();
