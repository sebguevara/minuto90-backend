import { ApiSportsHttpClient } from "./api-sports-http.client";
import type {
  Formula1DriverRankingsResponse,
  Formula1DriversResponse,
  Formula1RacesResponse,
  Formula1SeasonsResponse,
  Formula1TeamRankingsResponse,
  Formula1TeamsResponse,
  GetFormula1DriversQuery,
  GetFormula1RacesQuery,
  GetFormula1RankingsQuery,
  GetFormula1TeamsQuery,
} from "../domain/formula1.types";

const FORMULA1_API_URL =
  process.env.FORMULA1_API_URL ?? "https://v1.formula-1.api-sports.io";
const FORMULA1_API_KEY = process.env.FORMULA1_API_KEY ?? process.env.API_KEY ?? "";

const TTL_BY_ENDPOINT: Record<string, number> = {
  "/seasons": 60 * 60 * 24,
  "/races": 60,
  "/teams": 60 * 60,
  "/drivers": 60 * 60,
  "/rankings/drivers": 60 * 15,
  "/rankings/teams": 60 * 15,
};

export interface Formula1ApiClientContract {
  getSeasons(): Promise<Formula1SeasonsResponse>;
  getRaces(query: GetFormula1RacesQuery): Promise<Formula1RacesResponse>;
  getTeams(query: GetFormula1TeamsQuery): Promise<Formula1TeamsResponse>;
  getDrivers(query: GetFormula1DriversQuery): Promise<Formula1DriversResponse>;
  getDriverRankings(query: GetFormula1RankingsQuery): Promise<Formula1DriverRankingsResponse>;
  getTeamRankings(query: GetFormula1RankingsQuery): Promise<Formula1TeamRankingsResponse>;
}

export class Formula1ApiClient implements Formula1ApiClientContract {
  private readonly httpClient = new ApiSportsHttpClient({
    sport: "formula1",
    sportLabel: "Formula 1",
    sportCode: "FORMULA1",
    baseUrl: FORMULA1_API_URL,
    apiKey: FORMULA1_API_KEY,
    ttlByEndpoint: TTL_BY_ENDPOINT,
  });

  getSeasons() {
    return this.httpClient.request<Formula1SeasonsResponse>("/seasons");
  }

  getRaces(query: GetFormula1RacesQuery) {
    return this.httpClient.request<Formula1RacesResponse>("/races", query);
  }

  getTeams(query: GetFormula1TeamsQuery) {
    return this.httpClient.request<Formula1TeamsResponse>("/teams", query);
  }

  getDrivers(query: GetFormula1DriversQuery) {
    return this.httpClient.request<Formula1DriversResponse>("/drivers", query);
  }

  getDriverRankings(query: GetFormula1RankingsQuery) {
    return this.httpClient.request<Formula1DriverRankingsResponse>(
      "/rankings/drivers",
      query
    );
  }

  getTeamRankings(query: GetFormula1RankingsQuery) {
    return this.httpClient.request<Formula1TeamRankingsResponse>("/rankings/teams", query);
  }
}

export const formula1ApiClient = new Formula1ApiClient();

