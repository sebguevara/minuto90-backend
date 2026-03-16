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
import { hockeyApiClient, type HockeyApiClientContract } from "../infrastructure/hockey-api.client";

export interface HockeyServiceContract {
  getSeasons(): Promise<HockeySeasonsResponse>;
  getLeagues(query: GetHockeyLeaguesQuery): Promise<HockeyLeaguesResponse>;
  getGames(query: GetHockeyGamesQuery): Promise<HockeyGamesResponse>;
  getTeams(query: GetHockeyTeamsQuery): Promise<HockeyTeamsResponse>;
  getStandings(query: GetHockeyStandingsQuery): Promise<HockeyStandingsResponse>;
}

export class HockeyService implements HockeyServiceContract {
  constructor(private readonly client: HockeyApiClientContract = hockeyApiClient) {}

  getSeasons() {
    return this.client.getSeasons();
  }

  getLeagues(query: GetHockeyLeaguesQuery) {
    return this.client.getLeagues(query);
  }

  getGames(query: GetHockeyGamesQuery) {
    return this.client.getGames(query);
  }

  getTeams(query: GetHockeyTeamsQuery) {
    return this.client.getTeams(query);
  }

  getStandings(query: GetHockeyStandingsQuery) {
    return this.client.getStandings(query);
  }
}

export const hockeyService = new HockeyService();

