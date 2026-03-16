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
import { rugbyApiClient, type RugbyApiClientContract } from "../infrastructure/rugby-api.client";

export interface RugbyServiceContract {
  getSeasons(): Promise<RugbySeasonsResponse>;
  getLeagues(query: GetRugbyLeaguesQuery): Promise<RugbyLeaguesResponse>;
  getGames(query: GetRugbyGamesQuery): Promise<RugbyGamesResponse>;
  getTeams(query: GetRugbyTeamsQuery): Promise<RugbyTeamsResponse>;
  getStandings(query: GetRugbyStandingsQuery): Promise<RugbyStandingsResponse>;
}

export class RugbyService implements RugbyServiceContract {
  constructor(private readonly client: RugbyApiClientContract = rugbyApiClient) {}

  getSeasons() {
    return this.client.getSeasons();
  }

  getLeagues(query: GetRugbyLeaguesQuery) {
    return this.client.getLeagues(query);
  }

  getGames(query: GetRugbyGamesQuery) {
    return this.client.getGames(query);
  }

  getTeams(query: GetRugbyTeamsQuery) {
    return this.client.getTeams(query);
  }

  getStandings(query: GetRugbyStandingsQuery) {
    return this.client.getStandings(query);
  }
}

export const rugbyService = new RugbyService();

