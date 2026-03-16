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
import {
  formula1ApiClient,
  type Formula1ApiClientContract,
} from "../infrastructure/formula1-api.client";

export interface Formula1ServiceContract {
  getSeasons(): Promise<Formula1SeasonsResponse>;
  getRaces(query: GetFormula1RacesQuery): Promise<Formula1RacesResponse>;
  getTeams(query: GetFormula1TeamsQuery): Promise<Formula1TeamsResponse>;
  getDrivers(query: GetFormula1DriversQuery): Promise<Formula1DriversResponse>;
  getDriverRankings(query: GetFormula1RankingsQuery): Promise<Formula1DriverRankingsResponse>;
  getTeamRankings(query: GetFormula1RankingsQuery): Promise<Formula1TeamRankingsResponse>;
}

export class Formula1Service implements Formula1ServiceContract {
  constructor(private readonly client: Formula1ApiClientContract = formula1ApiClient) {}

  getSeasons() {
    return this.client.getSeasons();
  }

  getRaces(query: GetFormula1RacesQuery) {
    return this.client.getRaces(query);
  }

  getTeams(query: GetFormula1TeamsQuery) {
    return this.client.getTeams(query);
  }

  getDrivers(query: GetFormula1DriversQuery) {
    return this.client.getDrivers(query);
  }

  getDriverRankings(query: GetFormula1RankingsQuery) {
    return this.client.getDriverRankings(query);
  }

  getTeamRankings(query: GetFormula1RankingsQuery) {
    return this.client.getTeamRankings(query);
  }
}

export const formula1Service = new Formula1Service();
