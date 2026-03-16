import { ApiSportsHttpClient } from "./api-sports-http.client";
import type {
  BasketballGamesResponse,
  BasketballLeaguesResponse,
  BasketballSeasonsResponse,
  BasketballStandingsResponse,
  BasketballTeamsResponse,
  GetBasketballGamesQuery,
  GetBasketballLeaguesQuery,
  GetBasketballSeasonsQuery,
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
  "/standings": 60 * 15,
};

export interface BasketballApiClientContract {
  getSeasons(query?: GetBasketballSeasonsQuery): Promise<BasketballSeasonsResponse>;
  getLeagues(query: GetBasketballLeaguesQuery): Promise<BasketballLeaguesResponse>;
  getGames(query: GetBasketballGamesQuery): Promise<BasketballGamesResponse>;
  getTeams(query: GetBasketballTeamsQuery): Promise<BasketballTeamsResponse>;
  getStandings(query: GetBasketballStandingsQuery): Promise<BasketballStandingsResponse>;
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

  getStandings(query: GetBasketballStandingsQuery) {
    return this.httpClient.request<BasketballStandingsResponse>("/standings", query);
  }
}

export const basketballApiClient = new BasketballApiClient();

