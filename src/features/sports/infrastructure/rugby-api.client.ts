import { ApiSportsHttpClient } from "./api-sports-http.client";
import type {
  GetRugbyGamesQuery,
  GetRugbyLeaguesQuery,
  GetRugbyStandingsQuery,
  GetRugbyTeamsQuery,
  RugbyGamesResponse,
  RugbyLeaguesResponse,
  RugbySeasonsResponse,
  RugbyStandingsResponse,
  RugbyTeamsResponse,
} from "../domain/rugby.types";

const RUGBY_API_URL = process.env.RUGBY_API_URL ?? "https://v1.rugby.api-sports.io";
const RUGBY_API_KEY = process.env.RUGBY_API_KEY ?? process.env.API_KEY ?? "";

const TTL_BY_ENDPOINT: Record<string, number> = {
  "/seasons": 60 * 60 * 24,
  "/leagues": 60 * 60 * 12,
  "/games": 60,
  "/teams": 60 * 60,
  "/standings": 60 * 15,
};

export interface RugbyApiClientContract {
  getSeasons(): Promise<RugbySeasonsResponse>;
  getLeagues(query: GetRugbyLeaguesQuery): Promise<RugbyLeaguesResponse>;
  getGames(query: GetRugbyGamesQuery): Promise<RugbyGamesResponse>;
  getTeams(query: GetRugbyTeamsQuery): Promise<RugbyTeamsResponse>;
  getStandings(query: GetRugbyStandingsQuery): Promise<RugbyStandingsResponse>;
  request<TResponse = unknown>(endpoint: string, query?: Record<string, unknown>): Promise<TResponse>;
}

export class RugbyApiClient implements RugbyApiClientContract {
  private readonly httpClient = new ApiSportsHttpClient({
    sport: "rugby",
    sportLabel: "Rugby",
    sportCode: "RUGBY",
    baseUrl: RUGBY_API_URL,
    apiKey: RUGBY_API_KEY,
    ttlByEndpoint: TTL_BY_ENDPOINT,
  });

  getSeasons() {
    return this.httpClient.request<RugbySeasonsResponse>("/seasons");
  }

  getLeagues(query: GetRugbyLeaguesQuery) {
    return this.httpClient.request<RugbyLeaguesResponse>("/leagues", query);
  }

  getGames(query: GetRugbyGamesQuery) {
    return this.httpClient.request<RugbyGamesResponse>("/games", query);
  }

  getTeams(query: GetRugbyTeamsQuery) {
    return this.httpClient.request<RugbyTeamsResponse>("/teams", query);
  }

  getStandings(query: GetRugbyStandingsQuery) {
    return this.httpClient.request<RugbyStandingsResponse>("/standings", query);
  }

  request<TResponse = unknown>(endpoint: string, query?: Record<string, unknown>) {
    return this.httpClient.request<TResponse>(endpoint, query);
  }
}

export const rugbyApiClient = new RugbyApiClient();
