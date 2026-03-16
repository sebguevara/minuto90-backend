import { logWarn, logInfo } from "../../../shared/logging/logger";
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
  createFootballConfigurationError,
  createFootballUnexpectedError,
  createFootballUpstreamError,
} from "../domain/football.errors";
import { buildFootballCacheKey, serializeApiFootballParams } from "./football-cache-key";
import type { FootballCacheStore } from "./football-cache.store";
import { redisFootballCacheStore } from "./football-cache.store";
import { getFootballCacheTtlSeconds } from "./football-cache-ttl";

const FOOTBALL_API_URL = process.env.FOOTBALL_API_URL ?? "https://v3.football.api-sports.io";
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY ?? process.env.API_KEY ?? "";

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface FootballApiClientOptions {
  baseUrl?: string;
  apiKey?: string;
  fetchFn?: FetchLike;
  cache?: FootballCacheStore;
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
    return this.request<ApiFootballFixtureHeadToHeadEnvelope>("/fixtures/headtohead", query);
  }

  async getFixtureStatistics(query: GetFixtureStatisticsQuery) {
    return this.request<ApiFootballFixtureStatisticsEnvelope>("/fixtures/statistics", query);
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
    return this.request<ApiFootballTopYellowCardsEnvelope>("/players/topyellowcards", query);
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
    params?: any
  ): Promise<TEnvelope> {
    if (!this.apiKey) {
      throw createFootballConfigurationError({ endpoint });
    }

    const cacheKey = buildFootballCacheKey(endpoint, params);
    const ttlSeconds = getFootballCacheTtlSeconds(endpoint, params);
    const cached = ttlSeconds > 0 ? await this.cache.get<TEnvelope>(cacheKey) : null;

    if (cached) {
      return cached;
    }

    const serializedParams = serializeApiFootballParams(params);
    const url = serializedParams
      ? `${this.baseUrl}${endpoint}?${serializedParams}`
      : `${this.baseUrl}${endpoint}`;

    const response = await this.fetchFn(url, {
      method: "GET",
      headers: {
        "x-rapidapi-key": this.apiKey,
        "x-rapidapi-host": new URL(this.baseUrl).host,
      },
    });

    const body = await response.text();

    if (!response.ok) {
      const details = normalizeUpstreamBody(body);
      if (response.status === 429) {
        throw createFootballUpstreamError(429, "La consulta excedió el límite permitido", {
          endpoint,
          details,
        });
      }

      if (response.status === 401 || response.status === 403) {
        throw createFootballUpstreamError(
          response.status,
          "La API de Football rechazó las credenciales configuradas",
          { endpoint, details }
        );
      }

      throw createFootballUpstreamError(
        response.status >= 500 ? 503 : 502,
        "No se pudo obtener la información de Football",
        { endpoint, upstreamStatus: response.status, details }
      );
    }

    let json: unknown;
    try {
      json = body ? (JSON.parse(body) as unknown) : null;
    } catch {
      throw createFootballUnexpectedError({ endpoint, body });
    }

    if (!isApiFootballEnvelope(json)) {
      throw createFootballUnexpectedError({ endpoint, body: json as Record<string, unknown> });
    }

    if (ttlSeconds > 0) {
      await this.cache.set(cacheKey, json, ttlSeconds);
    } else {
      logWarn("football.cache.ttl_missing", { endpoint });
    }

    return json as TEnvelope;
  }
}

export const footballApiClient = new FootballApiClient();
