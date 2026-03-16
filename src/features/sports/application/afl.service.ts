import type {
  AflGamesResponse,
  AflLeaguesResponse,
  AflSeasonsResponse,
  AflStandingsResponse,
  AflTeamsResponse,
  GetAflGamesQuery,
  GetAflLeaguesQuery,
  GetAflStandingsQuery,
  GetAflTeamsQuery,
} from "../domain/afl.types";
import { aflApiClient, type AflApiClientContract } from "../infrastructure/afl-api.client";

export interface AflServiceContract {
  getSeasons(): Promise<AflSeasonsResponse>;
  getLeagues(query: GetAflLeaguesQuery): Promise<AflLeaguesResponse>;
  getGames(query: GetAflGamesQuery): Promise<AflGamesResponse>;
  getTeams(query: GetAflTeamsQuery): Promise<AflTeamsResponse>;
  getStandings(query: GetAflStandingsQuery): Promise<AflStandingsResponse>;
}

export class AflService implements AflServiceContract {
  constructor(private readonly client: AflApiClientContract = aflApiClient) {}

  getSeasons() {
    return this.client.getSeasons();
  }

  getLeagues(query: GetAflLeaguesQuery) {
    return this.client.getLeagues(query);
  }

  getGames(query: GetAflGamesQuery) {
    return this.client.getGames(query);
  }

  getTeams(query: GetAflTeamsQuery) {
    return this.client.getTeams(query);
  }

  getStandings(query: GetAflStandingsQuery) {
    return this.client.getStandings(query);
  }
}

export const aflService = new AflService();

