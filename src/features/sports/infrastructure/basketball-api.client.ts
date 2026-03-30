import { ApiSportsHttpClient } from "./api-sports-http.client";
import type {
  BasketballGamesResponse,
  BasketballLeaguesResponse,
  BasketballPlayersResponse,
  BasketballSeasonsResponse,
  BasketballStatisticsResponse,
  BasketballStandingsResponse,
  BasketballTeamsResponse,
  GetBasketballGamesQuery,
  GetBasketballLeaguesQuery,
  GetBasketballPlayersQuery,
  GetBasketballSeasonsQuery,
  GetBasketballStatisticsQuery,
  GetBasketballStandingsQuery,
  GetBasketballTeamsQuery,
} from "../domain/basketball.types";

const BASKETBALL_API_URL =
  process.env.BASKETBALL_API_URL ?? "https://v1.basketball.api-sports.io";
const BASKETBALL_API_KEY = process.env.BASKETBALL_API_KEY ?? process.env.API_KEY ?? "";

const TTL_BY_ENDPOINT: Record<string, number> = {
  "/seasons": 60 * 60 * 24,
  "/leagues": 60 * 60 * 12,
  "/games": 60,
  "/teams": 60 * 60,
  "/players": 60 * 30,
  "/statistics": 60 * 5,
  "/standings": 60 * 15,
};

export interface BasketballApiClientContract {
  getSeasons(query?: GetBasketballSeasonsQuery): Promise<BasketballSeasonsResponse>;
  getLeagues(query: GetBasketballLeaguesQuery): Promise<BasketballLeaguesResponse>;
  getGames(query: GetBasketballGamesQuery): Promise<BasketballGamesResponse>;
  getTeams(query: GetBasketballTeamsQuery): Promise<BasketballTeamsResponse>;
  getPlayers(query: GetBasketballPlayersQuery): Promise<BasketballPlayersResponse>;
  getStatistics(query: GetBasketballStatisticsQuery): Promise<BasketballStatisticsResponse>;
  getStandings(query: GetBasketballStandingsQuery): Promise<BasketballStandingsResponse>;
  request<TResponse = unknown>(endpoint: string, query?: Record<string, unknown>): Promise<TResponse>;
}

export class BasketballApiClient implements BasketballApiClientContract {
  private readonly httpClient = new ApiSportsHttpClient({
    sport: "basketball",
    sportLabel: "Basketball",
    sportCode: "BASKETBALL",
    baseUrl: BASKETBALL_API_URL,
    apiKey: BASKETBALL_API_KEY,
    ttlByEndpoint: TTL_BY_ENDPOINT,
  });

  getSeasons(query?: GetBasketballSeasonsQuery) {
    return this.httpClient.request<BasketballSeasonsResponse>("/seasons", query);
  }

  getLeagues(query: GetBasketballLeaguesQuery) {
    return this.httpClient.request<BasketballLeaguesResponse>("/leagues", query);
  }

  getGames(query: GetBasketballGamesQuery) {
    return this.httpClient.request<BasketballGamesResponse>("/games", query);
  }

  getTeams(query: GetBasketballTeamsQuery) {
    return this.httpClient.request<BasketballTeamsResponse>("/teams", query);
  }

  getPlayers(query: GetBasketballPlayersQuery) {
    return this.httpClient.request<BasketballPlayersResponse>("/players", query);
  }

  getStatistics(query: GetBasketballStatisticsQuery) {
    return this.httpClient.request<BasketballStatisticsResponse>("/statistics", query);
  }

  getStandings(query: GetBasketballStandingsQuery) {
    return this.httpClient.request<BasketballStandingsResponse>("/standings", query);
  }

  request<TResponse = unknown>(endpoint: string, query?: Record<string, unknown>) {
    return this.httpClient.request<TResponse>(endpoint, query);
  }
}

export const basketballApiClient = new BasketballApiClient();
