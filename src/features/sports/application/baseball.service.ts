import type {
  BaseballGamesResponse,
  BaseballLeaguesResponse,
  BaseballSeasonsResponse,
  BaseballStandingsResponse,
  BaseballTeamsResponse,
  GetBaseballGamesQuery,
  GetBaseballLeaguesQuery,
  GetBaseballStandingsQuery,
  GetBaseballTeamsQuery,
} from "../domain/baseball.types";
import {
  baseballApiClient,
  type BaseballApiClientContract,
} from "../infrastructure/baseball-api.client";

export interface BaseballServiceContract {
  getSeasons(): Promise<BaseballSeasonsResponse>;
  getLeagues(query: GetBaseballLeaguesQuery): Promise<BaseballLeaguesResponse>;
  getGames(query: GetBaseballGamesQuery): Promise<BaseballGamesResponse>;
  getTeams(query: GetBaseballTeamsQuery): Promise<BaseballTeamsResponse>;
  getStandings(query: GetBaseballStandingsQuery): Promise<BaseballStandingsResponse>;
}

export class BaseballService implements BaseballServiceContract {
  constructor(private readonly client: BaseballApiClientContract = baseballApiClient) {}

  getSeasons() {
    return this.client.getSeasons();
  }

  getLeagues(query: GetBaseballLeaguesQuery) {
    return this.client.getLeagues(query);
  }

  getGames(query: GetBaseballGamesQuery) {
    return this.client.getGames(query);
  }

  getTeams(query: GetBaseballTeamsQuery) {
    return this.client.getTeams(query);
  }

  getStandings(query: GetBaseballStandingsQuery) {
    return this.client.getStandings(query);
  }
}

export const baseballService = new BaseballService();
