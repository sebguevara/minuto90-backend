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
import { nbaApiClient, type NbaApiClientContract } from "../infrastructure/nba-api.client";

export interface NbaServiceContract {
  getSeasons(query?: GetNbaSeasonsQuery): Promise<NbaSeasonsResponse>;
  getLeagues(query: GetNbaLeaguesQuery): Promise<NbaLeaguesResponse>;
  getGames(query: GetNbaGamesQuery): Promise<NbaGamesResponse>;
  getTeams(query: GetNbaTeamsQuery): Promise<NbaTeamsResponse>;
  getStandings(query: GetNbaStandingsQuery): Promise<NbaStandingsResponse>;
}

export class NbaService implements NbaServiceContract {
  constructor(private readonly client: NbaApiClientContract = nbaApiClient) {}

  getSeasons(query?: GetNbaSeasonsQuery) {
    return this.client.getSeasons(query);
  }

  getLeagues(query: GetNbaLeaguesQuery) {
    return this.client.getLeagues(query);
  }

  getGames(query: GetNbaGamesQuery) {
    return this.client.getGames(query);
  }

  getTeams(query: GetNbaTeamsQuery) {
    return this.client.getTeams(query);
  }

  getStandings(query: GetNbaStandingsQuery) {
    return this.client.getStandings(query);
  }
}

export const nbaService = new NbaService();

