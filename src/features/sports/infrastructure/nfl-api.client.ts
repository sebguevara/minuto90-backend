import { ApiSportsHttpClient } from "./api-sports-http.client";
import type {
  GetNflGamesQuery,
  GetNflLeaguesQuery,
  GetNflStandingsQuery,
  GetNflTeamsQuery,
  NflGamesResponse,
  NflLeaguesResponse,
  NflSeasonsResponse,
  NflStandingsResponse,
  NflTeamsResponse,
} from "../domain/nfl.types";

const NFL_API_URL =
  process.env.NFL_API_URL ?? "https://v1.american-football.api-sports.io";
const NFL_API_KEY = process.env.NFL_API_KEY ?? process.env.API_KEY ?? "";

const TTL_BY_ENDPOINT: Record<string, number> = {
  "/seasons": 60 * 60 * 24,
  "/leagues": 60 * 60 * 12,
  "/games": 60,
  "/teams": 60 * 60,
  "/standings": 60 * 15,
};

export interface NflApiClientContract {
  getSeasons(): Promise<NflSeasonsResponse>;
  getLeagues(query: GetNflLeaguesQuery): Promise<NflLeaguesResponse>;
  getGames(query: GetNflGamesQuery): Promise<NflGamesResponse>;
  getTeams(query: GetNflTeamsQuery): Promise<NflTeamsResponse>;
  getStandings(query: GetNflStandingsQuery): Promise<NflStandingsResponse>;
  request<TResponse = unknown>(endpoint: string, query?: Record<string, unknown>): Promise<TResponse>;
}

export class NflApiClient implements NflApiClientContract {
  private readonly httpClient = new ApiSportsHttpClient({
    sport: "nfl",
    sportLabel: "NFL",
    sportCode: "NFL",
    baseUrl: NFL_API_URL,
    apiKey: NFL_API_KEY,
    ttlByEndpoint: TTL_BY_ENDPOINT,
  });

  getSeasons() {
    return this.httpClient.request<NflSeasonsResponse>("/seasons");
  }

  getLeagues(query: GetNflLeaguesQuery) {
    return this.httpClient.request<NflLeaguesResponse>("/leagues", query);
  }

  getGames(query: GetNflGamesQuery) {
    return this.httpClient.request<NflGamesResponse>("/games", query);
  }

  getTeams(query: GetNflTeamsQuery) {
    return this.httpClient.request<NflTeamsResponse>("/teams", query);
  }

  getStandings(query: GetNflStandingsQuery) {
    return this.httpClient.request<NflStandingsResponse>("/standings", query);
  }

  request<TResponse = unknown>(endpoint: string, query?: Record<string, unknown>) {
    return this.httpClient.request<TResponse>(endpoint, query);
  }
}

export const nflApiClient = new NflApiClient();
