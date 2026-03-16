import { ApiSportsHttpClient } from "./api-sports-http.client";
import type {
  BaseballGamesResponse,
  BaseballLeaguesResponse,
  BaseballSeasonsResponse,
  BaseballStandingsResponse,
  BaseballTeamsResponse,
  GetBaseballGamesQuery,
  GetBaseballLeaguesQuery,
  GetBaseballStandingsQuery,
  GetBaseballTeamsQuery,
} from "../domain/baseball.types";

const BASEBALL_API_URL = process.env.BASEBALL_API_URL ?? "https://v1.baseball.api-sports.io";
const BASEBALL_API_KEY = process.env.BASEBALL_API_KEY ?? process.env.API_KEY ?? "";

const TTL_BY_ENDPOINT: Record<string, number> = {
  "/seasons": 60 * 60 * 24,
  "/leagues": 60 * 60 * 12,
  "/games": 60,
  "/teams": 60 * 60,
  "/standings": 60 * 15,
};

export interface BaseballApiClientContract {
  getSeasons(): Promise<BaseballSeasonsResponse>;
  getLeagues(query: GetBaseballLeaguesQuery): Promise<BaseballLeaguesResponse>;
  getGames(query: GetBaseballGamesQuery): Promise<BaseballGamesResponse>;
  getTeams(query: GetBaseballTeamsQuery): Promise<BaseballTeamsResponse>;
  getStandings(query: GetBaseballStandingsQuery): Promise<BaseballStandingsResponse>;
}

export class BaseballApiClient implements BaseballApiClientContract {
  private readonly httpClient = new ApiSportsHttpClient({
    sport: "baseball",
    sportLabel: "Baseball",
    sportCode: "BASEBALL",
    baseUrl: BASEBALL_API_URL,
    apiKey: BASEBALL_API_KEY,
    ttlByEndpoint: TTL_BY_ENDPOINT,
  });

  getSeasons() {
    return this.httpClient.request<BaseballSeasonsResponse>("/seasons");
  }

  getLeagues(query: GetBaseballLeaguesQuery) {
    return this.httpClient.request<BaseballLeaguesResponse>("/leagues", query);
  }

  getGames(query: GetBaseballGamesQuery) {
    return this.httpClient.request<BaseballGamesResponse>("/games", query);
  }

  getTeams(query: GetBaseballTeamsQuery) {
    return this.httpClient.request<BaseballTeamsResponse>("/teams", query);
  }

  getStandings(query: GetBaseballStandingsQuery) {
    return this.httpClient.request<BaseballStandingsResponse>("/standings", query);
  }
}

export const baseballApiClient = new BaseballApiClient();

