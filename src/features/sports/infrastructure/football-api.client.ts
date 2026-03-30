import { createHash } from "node:crypto";
import { logError } from "../../../shared/logging/logger";
import type {
  ApiFootballCountriesEnvelope,
  ApiFootballEnvelope,
  ApiFootballFixtureEventsEnvelope,
  ApiFootballFixtureHeadToHeadEnvelope,
  ApiFootballFixtureLineupsEnvelope,
  ApiFootballFixturePlayersEnvelope,
  ApiFootballFixtureRoundsEnvelope,
  ApiFootballFixtureStatisticsEnvelope,
  ApiFootballFixturesEnvelope,
  ApiFootballInjuriesEnvelope,
  ApiFootballLeaguesEnvelope,
  ApiFootballLeaguesSeasonsEnvelope,
  ApiFootballPlayerProfilesEnvelope,
  ApiFootballPlayersEnvelope,
  ApiFootballPlayersSeasonsEnvelope,
  ApiFootballPlayerSquadsEnvelope,
  ApiFootballPlayerTeamsEnvelope,
  ApiFootballPredictionsEnvelope,
  ApiFootballSidelinedEnvelope,
  ApiFootballStandingsEnvelope,
  ApiFootballTeamStatisticsEnvelope,
  ApiFootballTeamCountriesEnvelope,
  ApiFootballTeamSeasonsEnvelope,
  ApiFootballTeamsEnvelope,
  ApiFootballTimezoneEnvelope,
  ApiFootballTopAssistsEnvelope,
  ApiFootballTopRedCardsEnvelope,
  ApiFootballTopScorersEnvelope,
  ApiFootballTopYellowCardsEnvelope,
  ApiFootballTransfersEnvelope,
  ApiFootballTrophiesEnvelope,
  ApiFootballVenuesEnvelope,
  ApiFootballCoachsEnvelope,
  ApiFootballOddsBetsEnvelope,
  ApiFootballOddsBookmakersEnvelope,
  ApiFootballOddsEnvelope,
  ApiFootballOddsLiveBetsEnvelope,
  ApiFootballOddsLiveEnvelope,
  ApiFootballOddsMappingEnvelope,
  GetCountriesQuery,
  GetCoachsQuery,
  GetFixtureEventsQuery,
  GetFixtureHeadToHeadQuery,
  GetFixtureLineupsQuery,
  GetFixturePlayersQuery,
  GetFixtureRoundsQuery,
  GetFixtureStatisticsQuery,
  GetFixturesQuery,
  GetInjuriesQuery,
  GetLeaguesQuery,
  GetPlayerProfilesQuery,
  GetPlayersQuery,
  GetPlayersSeasonsQuery,
  GetPlayerSquadsQuery,
  GetPlayerTeamsQuery,
  GetPredictionsQuery,
  GetSidelinedQuery,
  GetStandingsQuery,
  GetTeamStatisticsQuery,
  GetTeamCountriesQuery,
  GetTeamSeasonsQuery,
  GetTeamsQuery,
  GetTransfersQuery,
  GetTrophiesQuery,
  GetTopPlayersQuery,
  GetOddsBetsQuery,
  GetOddsBookmakersQuery,
  GetOddsLiveBetsQuery,
  GetOddsLiveQuery,
  GetOddsMappingQuery,
  GetOddsQuery,
  GetTimezoneQuery,
  GetVenuesQuery,
} from "../domain/football.types";
import {
  FootballModuleError,
  createFootballConfigurationError,
  createFootballFixtureTimeoutCooldownError,
  createFootballUnexpectedError,
  createFootballUpstreamError,
} from "../domain/football.errors";
import {
  buildFootballCacheKey,
  serializeApiFootballParams,
} from "./football-cache-key";
import type { FootballCacheStore } from "./football-cache.store";
import { redisFootballCacheStore } from "./football-cache.store";
import { getFootballCacheTtlSeconds } from "./football-cache-ttl";

const FOOTBALL_API_URL =
  process.env.FOOTBALL_API_URL ?? "https://v3.football.api-sports.io";
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY ?? process.env.API_KEY ?? "";

const pendingRequests = new Map<string, Promise<unknown>>();

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type FixtureFailureReason = "timeout" | "network" | "upstream" | "rate_limit";
type FixtureFetchSource = "cache" | "stale" | "upstream" | "cooldown";

type FixtureFailureMarker = {
  failureReason: FixtureFailureReason;
  retryAfterSeconds: number;
  fixtureIds: number[];
  cacheStatus: "stale" | "miss";
  upstreamStatus?: number;
  durationMs: number;
  createdAt: string;
};

type FixtureRequestContext = {
  endpoint: string;
  cacheKey: string;
  paramsHash: string;
  fixtureIds: number[];
  isSingleFixtureLookup: boolean;
  lastGoodKey: string | null;
  failureKey: string | null;
  lockKey: string;
  url: string;
};

type CoordinatedEnvelopeResult<TEnvelope> = {
  envelope: TEnvelope;
  source: FixtureFetchSource;
  failureReason?: FixtureFailureReason;
  retryAfterSeconds?: number;
  sharedLockWaitMs: number;
};

export interface FootballApiClientOptions {
  baseUrl?: string;
  apiKey?: string;
  fetchFn?: FetchLike;
  cache?: FootballCacheStore;
}

function readEnvNumber(
  name: string,
  fallback: number,
  minValue: number,
  maxValue: number
) {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw)) {
    return fallback;
  }

  return Math.min(Math.max(Math.floor(raw), minValue), maxValue);
}

const FOOTBALL_UPSTREAM_TIMEOUT_MS = readEnvNumber(
  "FOOTBALL_API_TIMEOUT_MS",
  12000,
  2000,
  60000
);
const FIXTURE_TIMEOUT_COOLDOWN_SECONDS = readEnvNumber(
  "FOOTBALL_FIXTURE_TIMEOUT_COOLDOWN_SECONDS",
  60,
  5,
  300
);
const FIXTURE_LAST_GOOD_TTL_SECONDS = readEnvNumber(
  "FOOTBALL_FIXTURE_LAST_GOOD_TTL_SECONDS",
  15 * 60,
  30,
  12 * 60 * 60
);
const FOOTBALL_SINGLE_FLIGHT_POLL_MS = readEnvNumber(
  "FOOTBALL_SINGLE_FLIGHT_POLL_MS",
  150,
  25,
  1000
);
const FOOTBALL_SINGLE_FLIGHT_LOCK_TTL_SECONDS = readEnvNumber(
  "FOOTBALL_SINGLE_FLIGHT_LOCK_TTL_SECONDS",
  Math.ceil(FOOTBALL_UPSTREAM_TIMEOUT_MS / 1000) + 5,
  5,
  90
);
const FOOTBALL_SINGLE_FLIGHT_WAIT_MS = readEnvNumber(
  "FOOTBALL_SINGLE_FLIGHT_WAIT_MS",
  FOOTBALL_UPSTREAM_TIMEOUT_MS + 1500,
  500,
  90000
);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isApiFootballEnvelope(value: unknown): value is ApiFootballEnvelope<unknown> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.get === "string" &&
    typeof candidate.results === "number" &&
    (!("paging" in candidate) ||
      candidate.paging === undefined ||
      (candidate.paging !== null && typeof candidate.paging === "object")) &&
    "response" in candidate
  );
}

function normalizeUpstreamBody(body: string) {
  if (!body) return undefined;

  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return { body };
  }
}

function getParamsHash(input: string) {
  return createHash("sha1").update(input).digest("hex").slice(0, 12);
}

function parseFixtureIds(params?: object) {
  if (!params) return [] as number[];
  const source = params as Record<string, unknown>;

  const idsFromList =
    typeof source.ids === "string"
      ? source.ids
          .split("-")
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value > 0)
      : [];

  const idsFromSingle =
    typeof source.id === "number" && Number.isFinite(source.id) && source.id > 0
      ? [source.id]
      : [];

  return Array.from(new Set([...idsFromSingle, ...idsFromList]));
}

function classifyRequestFailure(error: unknown): {
  reason: FixtureFailureReason;
  upstreamStatus?: number;
  name: string;
  message: string;
  code: string | null;
} {
  if (error instanceof FootballModuleError) {
    if (error.status === 429) {
      return {
        reason: "rate_limit",
        upstreamStatus: 429,
        name: error.name,
        message: error.message,
        code: error.code,
      };
    }

    return {
      reason: error.status >= 500 ? "upstream" : "network",
      upstreamStatus: error.status,
      name: error.name,
      message: error.message,
      code: error.code,
    };
  }

  const candidate = error as Error & { code?: string | number; cause?: unknown };
  const name = candidate?.name ?? "Error";
  const message = candidate?.message ?? String(error);
  const normalized = message.toLowerCase();
  const code = candidate?.code != null ? String(candidate.code) : null;

  if (
    name === "TimeoutError" ||
    name === "AbortError" ||
    normalized.includes("timed out") ||
    normalized.includes("timeout") ||
    code === "23" ||
    code === "ABORT_ERR"
  ) {
    return { reason: "timeout", name, message, code };
  }

  if (
    name === "TypeError" ||
    normalized.includes("fetch failed") ||
    normalized.includes("network") ||
    normalized.includes("socket") ||
    normalized.includes("econnreset") ||
    normalized.includes("enotfound") ||
    normalized.includes("econnrefused")
  ) {
    return { reason: "network", name, message, code };
  }

  return { reason: "upstream", name, message, code };
}

function shouldCreateFixtureCooldown(reason: FixtureFailureReason, upstreamStatus?: number) {
  return (
    reason === "timeout" ||
    reason === "network" ||
    (reason === "upstream" &&
      typeof upstreamStatus === "number" &&
      upstreamStatus >= 500)
  );
}

function createRequestContext(
  baseUrl: string,
  endpoint: string,
  params: object | undefined,
  cacheKey: string
): FixtureRequestContext {
  const source = (params ?? {}) as Record<string, unknown>;
  const serializedParams = serializeApiFootballParams(params);
  const url = serializedParams
    ? `${baseUrl}${endpoint}?${serializedParams}`
    : `${baseUrl}${endpoint}`;
  const fixtureIds = endpoint === "/fixtures" ? parseFixtureIds(params) : [];
  const isSingleFixtureLookup =
    endpoint === "/fixtures" &&
    fixtureIds.length === 1 &&
    !source.live &&
    !source.date &&
    !source.from &&
    !source.to &&
    !source.team &&
    !source.league;

  return {
    endpoint,
    cacheKey,
    paramsHash: getParamsHash(cacheKey),
    fixtureIds,
    isSingleFixtureLookup,
    lastGoodKey: isSingleFixtureLookup ? `${cacheKey}:last_good` : null,
    failureKey: isSingleFixtureLookup ? `${cacheKey}:failure` : null,
    lockKey: `${cacheKey}:lock`,
    url,
  };
}

async function readFailureMarker(
  cache: FootballCacheStore,
  failureKey: string | null
): Promise<FixtureFailureMarker | null> {
  if (!failureKey) return null;
  return cache.get<FixtureFailureMarker>(failureKey);
}

async function writeFailureMarker(
  cache: FootballCacheStore,
  context: FixtureRequestContext,
  marker: FixtureFailureMarker
) {
  if (!context.failureKey) return;
  await cache.set(context.failureKey, marker, marker.retryAfterSeconds);
}

async function deleteFailureMarker(cache: FootballCacheStore, failureKey: string | null) {
  if (!failureKey || typeof cache.del !== "function") return;
  await cache.del(failureKey);
}

async function readLastGoodEnvelope<TEnvelope>(
  cache: FootballCacheStore,
  lastGoodKey: string | null
) {
  if (!lastGoodKey) return null;
  return cache.get<TEnvelope>(lastGoodKey);
}

export interface FootballApiClientContract {
  getCountries(query: GetCountriesQuery): Promise<ApiFootballCountriesEnvelope>;
  getTimezone(): Promise<ApiFootballTimezoneEnvelope>;
  getLeagues(query: GetLeaguesQuery): Promise<ApiFootballLeaguesEnvelope>;
  getLeagueSeasons(): Promise<ApiFootballLeaguesSeasonsEnvelope>;
  getFixtures(query: GetFixturesQuery): Promise<ApiFootballFixturesEnvelope>;
  getFixtureRounds(query: GetFixtureRoundsQuery): Promise<ApiFootballFixtureRoundsEnvelope>;
  getFixtureHeadToHead(
    query: GetFixtureHeadToHeadQuery
  ): Promise<ApiFootballFixtureHeadToHeadEnvelope>;
  getFixtureStatistics(
    query: GetFixtureStatisticsQuery
  ): Promise<ApiFootballFixtureStatisticsEnvelope>;
  getFixtureEvents(query: GetFixtureEventsQuery): Promise<ApiFootballFixtureEventsEnvelope>;
  getFixtureLineups(query: GetFixtureLineupsQuery): Promise<ApiFootballFixtureLineupsEnvelope>;
  getFixturePlayers(query: GetFixturePlayersQuery): Promise<ApiFootballFixturePlayersEnvelope>;
  getTeams(query: GetTeamsQuery): Promise<ApiFootballTeamsEnvelope>;
  getTeamStatistics(query: GetTeamStatisticsQuery): Promise<ApiFootballTeamStatisticsEnvelope>;
  getTeamSeasons(query: GetTeamSeasonsQuery): Promise<ApiFootballTeamSeasonsEnvelope>;
  getTeamCountries(): Promise<ApiFootballTeamCountriesEnvelope>;
  getVenues(query: GetVenuesQuery): Promise<ApiFootballVenuesEnvelope>;
  getStandings(query: GetStandingsQuery): Promise<ApiFootballStandingsEnvelope>;
  getInjuries(query: GetInjuriesQuery): Promise<ApiFootballInjuriesEnvelope>;
  getPredictions(query: GetPredictionsQuery): Promise<ApiFootballPredictionsEnvelope>;
  getCoachs(query: GetCoachsQuery): Promise<ApiFootballCoachsEnvelope>;
  getPlayersSeasons(): Promise<ApiFootballPlayersSeasonsEnvelope>;
  getPlayerProfiles(query: GetPlayerProfilesQuery): Promise<ApiFootballPlayerProfilesEnvelope>;
  getPlayers(query: GetPlayersQuery): Promise<ApiFootballPlayersEnvelope>;
  getPlayerSquads(query: GetPlayerSquadsQuery): Promise<ApiFootballPlayerSquadsEnvelope>;
  getPlayerTeams(query: GetPlayerTeamsQuery): Promise<ApiFootballPlayerTeamsEnvelope>;
  getPlayersTopScorers(query: GetTopPlayersQuery): Promise<ApiFootballTopScorersEnvelope>;
  getPlayersTopAssists(query: GetTopPlayersQuery): Promise<ApiFootballTopAssistsEnvelope>;
  getPlayersTopYellowCards(
    query: GetTopPlayersQuery
  ): Promise<ApiFootballTopYellowCardsEnvelope>;
  getPlayersTopRedCards(query: GetTopPlayersQuery): Promise<ApiFootballTopRedCardsEnvelope>;
  getTransfers(query: GetTransfersQuery): Promise<ApiFootballTransfersEnvelope>;
  getTrophies(query: GetTrophiesQuery): Promise<ApiFootballTrophiesEnvelope>;
  getSidelined(query: GetSidelinedQuery): Promise<ApiFootballSidelinedEnvelope>;
  getOddsLive(query: GetOddsLiveQuery): Promise<ApiFootballOddsLiveEnvelope>;
  getOddsLiveBets(query: GetOddsLiveBetsQuery): Promise<ApiFootballOddsLiveBetsEnvelope>;
  getOdds(query: GetOddsQuery): Promise<ApiFootballOddsEnvelope>;
  getOddsMapping(query: GetOddsMappingQuery): Promise<ApiFootballOddsMappingEnvelope>;
  getOddsBookmakers(query: GetOddsBookmakersQuery): Promise<ApiFootballOddsBookmakersEnvelope>;
  getOddsBets(query: GetOddsBetsQuery): Promise<ApiFootballOddsBetsEnvelope>;
}

export class FootballApiClient implements FootballApiClientContract {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchFn: FetchLike;
  private readonly cache: FootballCacheStore;

  constructor(options: FootballApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? FOOTBALL_API_URL;
    this.apiKey = options.apiKey ?? FOOTBALL_API_KEY;
    this.fetchFn = options.fetchFn ?? fetch;
    this.cache = options.cache ?? redisFootballCacheStore;
  }

  async getCountries(query: GetCountriesQuery) {
    return this.request<ApiFootballCountriesEnvelope>("/countries", query);
  }

  async getTimezone() {
    return this.request<ApiFootballTimezoneEnvelope>("/timezone");
  }

  async getLeagues(query: GetLeaguesQuery) {
    return this.request<ApiFootballLeaguesEnvelope>("/leagues", query);
  }

  async getLeagueSeasons() {
    return this.request<ApiFootballLeaguesSeasonsEnvelope>("/leagues/seasons");
  }

  async getFixtures(query: GetFixturesQuery) {
    return this.request<ApiFootballFixturesEnvelope>("/fixtures", query);
  }

  async getFixtureRounds(query: GetFixtureRoundsQuery) {
    return this.request<ApiFootballFixtureRoundsEnvelope>("/fixtures/rounds", query);
  }

  async getFixtureHeadToHead(query: GetFixtureHeadToHeadQuery) {
    return this.request<ApiFootballFixtureHeadToHeadEnvelope>(
      "/fixtures/headtohead",
      query
    );
  }

  async getFixtureStatistics(query: GetFixtureStatisticsQuery) {
    return this.request<ApiFootballFixtureStatisticsEnvelope>(
      "/fixtures/statistics",
      query
    );
  }

  async getFixtureEvents(query: GetFixtureEventsQuery) {
    return this.request<ApiFootballFixtureEventsEnvelope>("/fixtures/events", query);
  }

  async getFixtureLineups(query: GetFixtureLineupsQuery) {
    return this.request<ApiFootballFixtureLineupsEnvelope>("/fixtures/lineups", query);
  }

  async getFixturePlayers(query: GetFixturePlayersQuery) {
    return this.request<ApiFootballFixturePlayersEnvelope>("/fixtures/players", query);
  }

  async getTeams(query: GetTeamsQuery) {
    return this.request<ApiFootballTeamsEnvelope>("/teams", query);
  }

  async getTeamStatistics(query: GetTeamStatisticsQuery) {
    return this.request<ApiFootballTeamStatisticsEnvelope>("/teams/statistics", query);
  }

  async getTeamSeasons(query: GetTeamSeasonsQuery) {
    return this.request<ApiFootballTeamSeasonsEnvelope>("/teams/seasons", query);
  }

  async getTeamCountries() {
    return this.request<ApiFootballTeamCountriesEnvelope>("/teams/countries");
  }

  async getVenues(query: GetVenuesQuery) {
    return this.request<ApiFootballVenuesEnvelope>("/venues", query);
  }

  async getStandings(query: GetStandingsQuery) {
    return this.request<ApiFootballStandingsEnvelope>("/standings", query);
  }

  async getInjuries(query: GetInjuriesQuery) {
    return this.request<ApiFootballInjuriesEnvelope>("/injuries", query);
  }

  async getPredictions(query: GetPredictionsQuery) {
    return this.request<ApiFootballPredictionsEnvelope>("/predictions", query);
  }

  async getCoachs(query: GetCoachsQuery) {
    return this.request<ApiFootballCoachsEnvelope>("/coachs", query);
  }

  async getPlayersSeasons() {
    return this.request<ApiFootballPlayersSeasonsEnvelope>("/players/seasons");
  }

  async getPlayerProfiles(query: GetPlayerProfilesQuery) {
    return this.request<ApiFootballPlayerProfilesEnvelope>("/players/profiles", query);
  }

  async getPlayers(query: GetPlayersQuery) {
    return this.request<ApiFootballPlayersEnvelope>("/players", query);
  }

  async getPlayerSquads(query: GetPlayerSquadsQuery) {
    return this.request<ApiFootballPlayerSquadsEnvelope>("/players/squads", query);
  }

  async getPlayerTeams(query: GetPlayerTeamsQuery) {
    return this.request<ApiFootballPlayerTeamsEnvelope>("/players/teams", query);
  }

  async getPlayersTopScorers(query: GetTopPlayersQuery) {
    return this.request<ApiFootballTopScorersEnvelope>("/players/topscorers", query);
  }

  async getPlayersTopAssists(query: GetTopPlayersQuery) {
    return this.request<ApiFootballTopAssistsEnvelope>("/players/topassists", query);
  }

  async getPlayersTopYellowCards(query: GetTopPlayersQuery) {
    return this.request<ApiFootballTopYellowCardsEnvelope>(
      "/players/topyellowcards",
      query
    );
  }

  async getPlayersTopRedCards(query: GetTopPlayersQuery) {
    return this.request<ApiFootballTopRedCardsEnvelope>("/players/topredcards", query);
  }

  async getTransfers(query: GetTransfersQuery) {
    return this.request<ApiFootballTransfersEnvelope>("/transfers", query);
  }

  async getTrophies(query: GetTrophiesQuery) {
    return this.request<ApiFootballTrophiesEnvelope>("/trophies", query);
  }

  async getSidelined(query: GetSidelinedQuery) {
    return this.request<ApiFootballSidelinedEnvelope>("/sidelined", query);
  }

  async getOddsLive(query: GetOddsLiveQuery) {
    return this.request<ApiFootballOddsLiveEnvelope>("/odds/live", query);
  }

  async getOddsLiveBets(query: GetOddsLiveBetsQuery) {
    return this.request<ApiFootballOddsLiveBetsEnvelope>("/odds/live/bets", query);
  }

  async getOdds(query: GetOddsQuery) {
    return this.request<ApiFootballOddsEnvelope>("/odds", query);
  }

  async getOddsMapping(query: GetOddsMappingQuery) {
    return this.request<ApiFootballOddsMappingEnvelope>("/odds/mapping", query);
  }

  async getOddsBookmakers(query: GetOddsBookmakersQuery) {
    return this.request<ApiFootballOddsBookmakersEnvelope>("/odds/bookmakers", query);
  }

  async getOddsBets(query: GetOddsBetsQuery) {
    return this.request<ApiFootballOddsBetsEnvelope>("/odds/bets", query);
  }

  private async request<TEnvelope extends ApiFootballEnvelope<unknown>>(
    endpoint: string,
    params?: object
  ): Promise<TEnvelope> {
    if (!this.apiKey) {
      throw createFootballConfigurationError({ endpoint });
    }

    const cacheKey = buildFootballCacheKey(endpoint, params);
    const ttlSeconds = getFootballCacheTtlSeconds(
      endpoint,
      params as Record<string, unknown> | undefined
    );
    const cached = ttlSeconds > 0 ? await this.cache.get<TEnvelope>(cacheKey) : null;

    if (cached) {
      return cached;
    }

    const context = createRequestContext(this.baseUrl, endpoint, params, cacheKey);
    const failureMarker = await readFailureMarker(this.cache, context.failureKey);
    if (context.isSingleFixtureLookup && failureMarker) {
      const stale = await readLastGoodEnvelope<TEnvelope>(this.cache, context.lastGoodKey);
      if (stale) {
        this.logFixtureRequest(context, {
          source: "stale",
          envelope: stale,
          failureReason: failureMarker.failureReason,
          retryAfterSeconds: failureMarker.retryAfterSeconds,
          sharedLockWaitMs: 0,
        });
        return stale;
      }

      throw createFootballFixtureTimeoutCooldownError({
        fixtureId: context.fixtureIds[0],
        fixtureIds: context.fixtureIds,
        retryAfterSeconds: failureMarker.retryAfterSeconds,
        cacheStatus: "miss",
        failureReason: failureMarker.failureReason,
      });
    }

    const result = await this.runCoordinatedRequest<TEnvelope>(context, ttlSeconds);
    this.logFixtureRequest(context, result);
    return result.envelope;
  }

  private async runCoordinatedRequest<TEnvelope extends ApiFootballEnvelope<unknown>>(
    context: FixtureRequestContext,
    ttlSeconds: number
  ): Promise<CoordinatedEnvelopeResult<TEnvelope>> {
    const localPending = pendingRequests.get(context.cacheKey) as
      | Promise<CoordinatedEnvelopeResult<TEnvelope>>
      | undefined;
    if (localPending) {
      return localPending;
    }

    const promise = this.runCoordinatedRequestImpl<TEnvelope>(context, ttlSeconds).finally(() => {
      pendingRequests.delete(context.cacheKey);
    });
    pendingRequests.set(context.cacheKey, promise);
    return promise;
  }

  private async runCoordinatedRequestImpl<TEnvelope extends ApiFootballEnvelope<unknown>>(
    context: FixtureRequestContext,
    ttlSeconds: number
  ): Promise<CoordinatedEnvelopeResult<TEnvelope>> {
    if (typeof this.cache.setNx !== "function") {
      return this.fetchAndCacheUpstream<TEnvelope>(context, ttlSeconds, 0);
    }

    const lockOwner = `${process.pid}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
    const lockAcquired = await this.cache.setNx(
      context.lockKey,
      { owner: lockOwner, createdAt: new Date().toISOString() },
      FOOTBALL_SINGLE_FLIGHT_LOCK_TTL_SECONDS
    );

    if (lockAcquired) {
      try {
        return await this.fetchAndCacheUpstream<TEnvelope>(context, ttlSeconds, 0);
      } finally {
        if (typeof this.cache.del === "function") {
          await this.cache.del(context.lockKey);
        }
      }
    }

    const waitStartedAt = Date.now();
    while (Date.now() - waitStartedAt < FOOTBALL_SINGLE_FLIGHT_WAIT_MS) {
      await sleep(FOOTBALL_SINGLE_FLIGHT_POLL_MS);

      const fresh =
        ttlSeconds > 0 ? await this.cache.get<TEnvelope>(context.cacheKey) : null;
      if (fresh) {
        return {
          envelope: fresh,
          source: "cache",
          sharedLockWaitMs: Date.now() - waitStartedAt,
        };
      }

      const failureMarker = await readFailureMarker(this.cache, context.failureKey);
      if (context.isSingleFixtureLookup && failureMarker) {
        const stale = await readLastGoodEnvelope<TEnvelope>(this.cache, context.lastGoodKey);
        if (stale) {
          return {
            envelope: stale,
            source: "stale",
            failureReason: failureMarker.failureReason,
            retryAfterSeconds: failureMarker.retryAfterSeconds,
            sharedLockWaitMs: Date.now() - waitStartedAt,
          };
        }

        throw createFootballFixtureTimeoutCooldownError({
          fixtureId: context.fixtureIds[0],
          fixtureIds: context.fixtureIds,
          retryAfterSeconds: failureMarker.retryAfterSeconds,
          cacheStatus: "miss",
          failureReason: failureMarker.failureReason,
        });
      }
    }

    return this.fetchAndCacheUpstream<TEnvelope>(
      context,
      ttlSeconds,
      Date.now() - waitStartedAt
    );
  }

  private async fetchAndCacheUpstream<TEnvelope extends ApiFootballEnvelope<unknown>>(
    context: FixtureRequestContext,
    ttlSeconds: number,
    sharedLockWaitMs: number
  ): Promise<CoordinatedEnvelopeResult<TEnvelope>> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort("timeout"), FOOTBALL_UPSTREAM_TIMEOUT_MS);

    try {
      const response = await this.fetchFn(context.url, {
        method: "GET",
        headers: {
          "x-rapidapi-key": this.apiKey,
          "x-rapidapi-host": new URL(this.baseUrl).host,
        },
        signal: controller.signal,
      });

      const body = await response.text();

      if (!response.ok) {
        const details = normalizeUpstreamBody(body);
        if (response.status === 429) {
          throw createFootballUpstreamError(429, "La consulta excedio el limite permitido", {
            endpoint: context.endpoint,
            details,
          });
        }

        if (response.status === 401 || response.status === 403) {
          throw createFootballUpstreamError(
            response.status,
            "La API de Football rechazo las credenciales configuradas",
            { endpoint: context.endpoint, details }
          );
        }

        throw createFootballUpstreamError(
          response.status >= 500 ? 503 : 502,
          "No se pudo obtener la informacion de Football",
          { endpoint: context.endpoint, upstreamStatus: response.status, details }
        );
      }

      let json: unknown;
      try {
        json = body ? (JSON.parse(body) as unknown) : null;
      } catch {
        throw createFootballUnexpectedError({ endpoint: context.endpoint, body });
      }

      if (!isApiFootballEnvelope(json)) {
        throw createFootballUnexpectedError({
          endpoint: context.endpoint,
          body: json as Record<string, unknown>,
        });
      }

      if (ttlSeconds > 0) {
        await this.cache.set(context.cacheKey, json, ttlSeconds);
      }

      if (context.lastGoodKey) {
        await this.cache.set(context.lastGoodKey, json, FIXTURE_LAST_GOOD_TTL_SECONDS);
      }
      await deleteFailureMarker(this.cache, context.failureKey);

      return {
        envelope: json as TEnvelope,
        source: "upstream",
        sharedLockWaitMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const failure = classifyRequestFailure(error);
      const stale = await readLastGoodEnvelope<TEnvelope>(this.cache, context.lastGoodKey);

      if (context.isSingleFixtureLookup && shouldCreateFixtureCooldown(failure.reason, failure.upstreamStatus)) {
        await writeFailureMarker(this.cache, context, {
          failureReason: failure.reason,
          retryAfterSeconds: FIXTURE_TIMEOUT_COOLDOWN_SECONDS,
          fixtureIds: context.fixtureIds,
          cacheStatus: stale ? "stale" : "miss",
          upstreamStatus: failure.upstreamStatus,
          durationMs,
          createdAt: new Date().toISOString(),
        });
      }

      logError("football.fixture.request_failed", {
        endpoint: context.endpoint,
        fixtureId: context.fixtureIds[0],
        fixtureIds: context.fixtureIds,
        paramsHash: context.paramsHash,
        source: stale ? "stale" : "upstream",
        attempt: 1,
        durationMs,
        outcome: failure.reason,
        failureReason: failure.reason,
        cacheStatus: stale ? "stale" : "miss",
        cooldownActive:
          context.isSingleFixtureLookup &&
          shouldCreateFixtureCooldown(failure.reason, failure.upstreamStatus),
        retryAfterSeconds:
          context.isSingleFixtureLookup &&
          shouldCreateFixtureCooldown(failure.reason, failure.upstreamStatus)
            ? FIXTURE_TIMEOUT_COOLDOWN_SECONDS
            : undefined,
        sharedLockWaitMs,
        upstreamStatus: failure.upstreamStatus,
        errorName: failure.name,
        errorMessage: failure.message,
        errorCode: failure.code,
      });

      if (stale) {
        return {
          envelope: stale,
          source: "stale",
          failureReason: failure.reason,
          retryAfterSeconds: shouldCreateFixtureCooldown(
            failure.reason,
            failure.upstreamStatus
          )
            ? FIXTURE_TIMEOUT_COOLDOWN_SECONDS
            : undefined,
          sharedLockWaitMs,
        };
      }

      if (context.isSingleFixtureLookup && shouldCreateFixtureCooldown(failure.reason, failure.upstreamStatus)) {
        throw createFootballFixtureTimeoutCooldownError({
          fixtureId: context.fixtureIds[0],
          fixtureIds: context.fixtureIds,
          retryAfterSeconds: FIXTURE_TIMEOUT_COOLDOWN_SECONDS,
          cacheStatus: "miss",
          failureReason: failure.reason,
        });
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private logFixtureRequest<TEnvelope extends ApiFootballEnvelope<unknown>>(
    context: FixtureRequestContext,
    result: CoordinatedEnvelopeResult<TEnvelope>
  ) {
    if (
      !context.isSingleFixtureLookup ||
      result.source === "cache" ||
      (result.source === "upstream" && result.sharedLockWaitMs <= 0)
    ) {
      return;
    }

    logError("football.fixture.request_result", {
      endpoint: context.endpoint,
      fixtureId: context.fixtureIds[0],
      fixtureIds: context.fixtureIds,
      paramsHash: context.paramsHash,
      source: result.source,
      attempt: 1,
      durationMs: undefined,
      outcome: result.source,
      failureReason: result.failureReason,
      cacheStatus: result.source === "stale" ? "stale" : "fresh",
      cooldownActive: result.source === "stale" || result.source === "cooldown",
      retryAfterSeconds: result.retryAfterSeconds,
      sharedLockWaitMs: result.sharedLockWaitMs,
    });
  }
}

export const footballApiClient = new FootballApiClient();
