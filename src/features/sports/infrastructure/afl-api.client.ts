import { ApiSportsHttpClient } from "./api-sports-http.client";
import type {
  AflGamesResponse,
  AflLeaguesResponse,
  AflSeasonsResponse,
  AflStandingsResponse,
  AflTeamsResponse,
  GetAflGamesQuery,
  GetAflLeaguesQuery,
  GetAflStandingsQuery,
  GetAflTeamsQuery,
} from "../domain/afl.types";

const AFL_API_URL = process.env.AFL_API_URL ?? "https://v1.aussie-rules.api-sports.io";
const AFL_API_KEY = process.env.AFL_API_KEY ?? process.env.API_KEY ?? "";

const TTL_BY_ENDPOINT: Record<string, number> = {
  "/seasons": 60 * 60 * 24,
  "/leagues": 60 * 60 * 12,
  "/games": 60,
  "/teams": 60 * 60,
  "/standings": 60 * 15,
};

export interface AflApiClientContract {
  getSeasons(): Promise<AflSeasonsResponse>;
  getLeagues(query: GetAflLeaguesQuery): Promise<AflLeaguesResponse>;
  getGames(query: GetAflGamesQuery): Promise<AflGamesResponse>;
  getTeams(query: GetAflTeamsQuery): Promise<AflTeamsResponse>;
  getStandings(query: GetAflStandingsQuery): Promise<AflStandingsResponse>;
  request<TResponse = unknown>(endpoint: string, query?: Record<string, unknown>): Promise<TResponse>;
}

export class AflApiClient implements AflApiClientContract {
  private readonly httpClient = new ApiSportsHttpClient({
    sport: "afl",
    sportLabel: "AFL",
    sportCode: "AFL",
    baseUrl: AFL_API_URL,
    apiKey: AFL_API_KEY,
    ttlByEndpoint: TTL_BY_ENDPOINT,
  });

  getSeasons() {
    return this.httpClient.request<AflSeasonsResponse>("/seasons");
  }

  getLeagues(query: GetAflLeaguesQuery) {
    return this.httpClient.request<AflLeaguesResponse>("/leagues", query);
  }

  getGames(query: GetAflGamesQuery) {
    return this.httpClient.request<AflGamesResponse>("/games", query);
  }

  getTeams(query: GetAflTeamsQuery) {
    return this.httpClient.request<AflTeamsResponse>("/teams", query);
  }

  getStandings(query: GetAflStandingsQuery) {
    return this.httpClient.request<AflStandingsResponse>("/standings", query);
  }

  request<TResponse = unknown>(endpoint: string, query?: Record<string, unknown>) {
    return this.httpClient.request<TResponse>(endpoint, query);
  }
}

export const aflApiClient = new AflApiClient();
