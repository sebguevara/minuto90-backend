import { ApiSportsHttpClient } from "./api-sports-http.client";
import type {
  GetVolleyballGamesQuery,
  GetVolleyballLeaguesQuery,
  GetVolleyballStandingsQuery,
  GetVolleyballTeamsQuery,
  VolleyballGamesResponse,
  VolleyballLeaguesResponse,
  VolleyballSeasonsResponse,
  VolleyballStandingsResponse,
  VolleyballTeamsResponse,
} from "../domain/volleyball.types";

const VOLLEYBALL_API_URL =
  process.env.VOLLEYBALL_API_URL ?? "https://v1.volleyball.api-sports.io";
const VOLLEYBALL_API_KEY =
  process.env.VOLLEYBALL_API_KEY ?? process.env.API_KEY ?? "";

const TTL_BY_ENDPOINT: Record<string, number> = {
  "/seasons": 60 * 60 * 24,
  "/leagues": 60 * 60 * 12,
  "/games": 60,
  "/teams": 60 * 60,
  "/standings": 60 * 15,
};

export interface VolleyballApiClientContract {
  getSeasons(): Promise<VolleyballSeasonsResponse>;
  getLeagues(query: GetVolleyballLeaguesQuery): Promise<VolleyballLeaguesResponse>;
  getGames(query: GetVolleyballGamesQuery): Promise<VolleyballGamesResponse>;
  getTeams(query: GetVolleyballTeamsQuery): Promise<VolleyballTeamsResponse>;
  getStandings(query: GetVolleyballStandingsQuery): Promise<VolleyballStandingsResponse>;
  request<TResponse = unknown>(endpoint: string, query?: Record<string, unknown>): Promise<TResponse>;
}

export class VolleyballApiClient implements VolleyballApiClientContract {
  private readonly httpClient = new ApiSportsHttpClient({
    sport: "volleyball",
    sportLabel: "Volleyball",
    sportCode: "VOLLEYBALL",
    baseUrl: VOLLEYBALL_API_URL,
    apiKey: VOLLEYBALL_API_KEY,
    ttlByEndpoint: TTL_BY_ENDPOINT,
  });

  getSeasons() {
    return this.httpClient.request<VolleyballSeasonsResponse>("/seasons");
  }

  getLeagues(query: GetVolleyballLeaguesQuery) {
    return this.httpClient.request<VolleyballLeaguesResponse>("/leagues", query);
  }

  getGames(query: GetVolleyballGamesQuery) {
    return this.httpClient.request<VolleyballGamesResponse>("/games", query);
  }

  getTeams(query: GetVolleyballTeamsQuery) {
    return this.httpClient.request<VolleyballTeamsResponse>("/teams", query);
  }

  getStandings(query: GetVolleyballStandingsQuery) {
    return this.httpClient.request<VolleyballStandingsResponse>("/standings", query);
  }

  request<TResponse = unknown>(endpoint: string, query?: Record<string, unknown>) {
    return this.httpClient.request<TResponse>(endpoint, query);
  }
}

export const volleyballApiClient = new VolleyballApiClient();
