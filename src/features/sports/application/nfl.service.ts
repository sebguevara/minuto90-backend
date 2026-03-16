import type {
  GetNflGamesQuery,
  GetNflLeaguesQuery,
  GetNflStandingsQuery,
  GetNflTeamsQuery,
  NflGamesResponse,
  NflLeaguesResponse,
  NflSeasonsResponse,
  NflStandingsResponse,
  NflTeamsResponse,
} from "../domain/nfl.types";
import { nflApiClient, type NflApiClientContract } from "../infrastructure/nfl-api.client";

export interface NflServiceContract {
  getSeasons(): Promise<NflSeasonsResponse>;
  getLeagues(query: GetNflLeaguesQuery): Promise<NflLeaguesResponse>;
  getGames(query: GetNflGamesQuery): Promise<NflGamesResponse>;
  getTeams(query: GetNflTeamsQuery): Promise<NflTeamsResponse>;
  getStandings(query: GetNflStandingsQuery): Promise<NflStandingsResponse>;
}

export class NflService implements NflServiceContract {
  constructor(private readonly client: NflApiClientContract = nflApiClient) {}

  getSeasons() {
    return this.client.getSeasons();
  }

  getLeagues(query: GetNflLeaguesQuery) {
    return this.client.getLeagues(query);
  }

  getGames(query: GetNflGamesQuery) {
    return this.client.getGames(query);
  }

  getTeams(query: GetNflTeamsQuery) {
    return this.client.getTeams(query);
  }

  getStandings(query: GetNflStandingsQuery) {
    return this.client.getStandings(query);
  }
}

export const nflService = new NflService();

