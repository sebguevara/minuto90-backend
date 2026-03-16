import { ApiSportsHttpClient } from "./api-sports-http.client";
import type {
  GetHandballGamesQuery,
  GetHandballLeaguesQuery,
  GetHandballStandingsQuery,
  GetHandballTeamsQuery,
  HandballGamesResponse,
  HandballLeaguesResponse,
  HandballSeasonsResponse,
  HandballStandingsResponse,
  HandballTeamsResponse,
} from "../domain/handball.types";

const HANDBALL_API_URL = process.env.HANDBALL_API_URL ?? "https://v1.handball.api-sports.io";
const HANDBALL_API_KEY = process.env.HANDBALL_API_KEY ?? process.env.API_KEY ?? "";

const TTL_BY_ENDPOINT: Record<string, number> = {
  "/seasons": 60 * 60 * 24,
  "/leagues": 60 * 60 * 12,
  "/games": 60,
  "/teams": 60 * 60,
  "/standings": 60 * 15,
};

export interface HandballApiClientContract {
  getSeasons(): Promise<HandballSeasonsResponse>;
  getLeagues(query: GetHandballLeaguesQuery): Promise<HandballLeaguesResponse>;
  getGames(query: GetHandballGamesQuery): Promise<HandballGamesResponse>;
  getTeams(query: GetHandballTeamsQuery): Promise<HandballTeamsResponse>;
  getStandings(query: GetHandballStandingsQuery): Promise<HandballStandingsResponse>;
}

export class HandballApiClient implements HandballApiClientContract {
  private readonly httpClient = new ApiSportsHttpClient({
    sport: "handball",
    sportLabel: "Handball",
    sportCode: "HANDBALL",
    baseUrl: HANDBALL_API_URL,
    apiKey: HANDBALL_API_KEY,
    ttlByEndpoint: TTL_BY_ENDPOINT,
  });

  getSeasons() {
    return this.httpClient.request<HandballSeasonsResponse>("/seasons");
  }

  getLeagues(query: GetHandballLeaguesQuery) {
    return this.httpClient.request<HandballLeaguesResponse>("/leagues", query);
  }

  getGames(query: GetHandballGamesQuery) {
    return this.httpClient.request<HandballGamesResponse>("/games", query);
  }

  getTeams(query: GetHandballTeamsQuery) {
    return this.httpClient.request<HandballTeamsResponse>("/teams", query);
  }

  getStandings(query: GetHandballStandingsQuery) {
    return this.httpClient.request<HandballStandingsResponse>("/standings", query);
  }
}

export const handballApiClient = new HandballApiClient();

