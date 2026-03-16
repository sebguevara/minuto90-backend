import { ApiSportsHttpClient } from "./api-sports-http.client";
import type {
  GetNbaGamesQuery,
  GetNbaLeaguesQuery,
  GetNbaSeasonsQuery,
  GetNbaStandingsQuery,
  GetNbaTeamsQuery,
  NbaGamesResponse,
  NbaLeaguesResponse,
  NbaSeasonsResponse,
  NbaStandingsResponse,
  NbaTeamsResponse,
} from "../domain/nba.types";

const NBA_API_URL = process.env.NBA_API_URL ?? "https://v1.basketball.api-sports.io";
const NBA_API_KEY = process.env.NBA_API_KEY ?? process.env.API_KEY ?? "";

const TTL_BY_ENDPOINT: Record<string, number> = {
  "/seasons": 60 * 60 * 24,
  "/leagues": 60 * 60 * 12,
  "/games": 60,
  "/teams": 60 * 60,
  "/standings": 60 * 15,
};

export interface NbaApiClientContract {
  getSeasons(query?: GetNbaSeasonsQuery): Promise<NbaSeasonsResponse>;
  getLeagues(query: GetNbaLeaguesQuery): Promise<NbaLeaguesResponse>;
  getGames(query: GetNbaGamesQuery): Promise<NbaGamesResponse>;
  getTeams(query: GetNbaTeamsQuery): Promise<NbaTeamsResponse>;
  getStandings(query: GetNbaStandingsQuery): Promise<NbaStandingsResponse>;
}

export class NbaApiClient implements NbaApiClientContract {
  private readonly httpClient = new ApiSportsHttpClient({
    sport: "nba",
    sportLabel: "NBA",
    sportCode: "NBA",
    baseUrl: NBA_API_URL,
    apiKey: NBA_API_KEY,
    ttlByEndpoint: TTL_BY_ENDPOINT,
  });

  getSeasons(query?: GetNbaSeasonsQuery) {
    return this.httpClient.request<NbaSeasonsResponse>("/seasons", query);
  }

  getLeagues(query: GetNbaLeaguesQuery) {
    return this.httpClient.request<NbaLeaguesResponse>("/leagues", query);
  }

  getGames(query: GetNbaGamesQuery) {
    return this.httpClient.request<NbaGamesResponse>("/games", query);
  }

  getTeams(query: GetNbaTeamsQuery) {
    return this.httpClient.request<NbaTeamsResponse>("/teams", query);
  }

  getStandings(query: GetNbaStandingsQuery) {
    return this.httpClient.request<NbaStandingsResponse>("/standings", query);
  }
}

export const nbaApiClient = new NbaApiClient();

