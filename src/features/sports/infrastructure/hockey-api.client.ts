import { ApiSportsHttpClient } from "./api-sports-http.client";
import type {
  GetHockeyGamesQuery,
  GetHockeyLeaguesQuery,
  GetHockeyStandingsQuery,
  GetHockeyTeamsQuery,
  HockeyGamesResponse,
  HockeyLeaguesResponse,
  HockeySeasonsResponse,
  HockeyStandingsResponse,
  HockeyTeamsResponse,
} from "../domain/hockey.types";

const HOCKEY_API_URL = process.env.HOCKEY_API_URL ?? "https://v1.hockey.api-sports.io";
const HOCKEY_API_KEY = process.env.HOCKEY_API_KEY ?? process.env.API_KEY ?? "";

const TTL_BY_ENDPOINT: Record<string, number> = {
  "/seasons": 60 * 60 * 24,
  "/leagues": 60 * 60 * 12,
  "/games": 60,
  "/teams": 60 * 60,
  "/standings": 60 * 15,
};

export interface HockeyApiClientContract {
  getSeasons(): Promise<HockeySeasonsResponse>;
  getLeagues(query: GetHockeyLeaguesQuery): Promise<HockeyLeaguesResponse>;
  getGames(query: GetHockeyGamesQuery): Promise<HockeyGamesResponse>;
  getTeams(query: GetHockeyTeamsQuery): Promise<HockeyTeamsResponse>;
  getStandings(query: GetHockeyStandingsQuery): Promise<HockeyStandingsResponse>;
}

export class HockeyApiClient implements HockeyApiClientContract {
  private readonly httpClient = new ApiSportsHttpClient({
    sport: "hockey",
    sportLabel: "Hockey",
    sportCode: "HOCKEY",
    baseUrl: HOCKEY_API_URL,
    apiKey: HOCKEY_API_KEY,
    ttlByEndpoint: TTL_BY_ENDPOINT,
  });

  getSeasons() {
    return this.httpClient.request<HockeySeasonsResponse>("/seasons");
  }

  getLeagues(query: GetHockeyLeaguesQuery) {
    return this.httpClient.request<HockeyLeaguesResponse>("/leagues", query);
  }

  getGames(query: GetHockeyGamesQuery) {
    return this.httpClient.request<HockeyGamesResponse>("/games", query);
  }

  getTeams(query: GetHockeyTeamsQuery) {
    return this.httpClient.request<HockeyTeamsResponse>("/teams", query);
  }

  getStandings(query: GetHockeyStandingsQuery) {
    return this.httpClient.request<HockeyStandingsResponse>("/standings", query);
  }
}

export const hockeyApiClient = new HockeyApiClient();

