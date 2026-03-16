import type {
  GetHandballGamesQuery,
  GetHandballLeaguesQuery,
  GetHandballStandingsQuery,
  GetHandballTeamsQuery,
  HandballGamesResponse,
  HandballLeaguesResponse,
  HandballSeasonsResponse,
  HandballStandingsResponse,
  HandballTeamsResponse,
} from "../domain/handball.types";
import {
  handballApiClient,
  type HandballApiClientContract,
} from "../infrastructure/handball-api.client";

export interface HandballServiceContract {
  getSeasons(): Promise<HandballSeasonsResponse>;
  getLeagues(query: GetHandballLeaguesQuery): Promise<HandballLeaguesResponse>;
  getGames(query: GetHandballGamesQuery): Promise<HandballGamesResponse>;
  getTeams(query: GetHandballTeamsQuery): Promise<HandballTeamsResponse>;
  getStandings(query: GetHandballStandingsQuery): Promise<HandballStandingsResponse>;
}

export class HandballService implements HandballServiceContract {
  constructor(private readonly client: HandballApiClientContract = handballApiClient) {}

  getSeasons() {
    return this.client.getSeasons();
  }

  getLeagues(query: GetHandballLeaguesQuery) {
    return this.client.getLeagues(query);
  }

  getGames(query: GetHandballGamesQuery) {
    return this.client.getGames(query);
  }

  getTeams(query: GetHandballTeamsQuery) {
    return this.client.getTeams(query);
  }

  getStandings(query: GetHandballStandingsQuery) {
    return this.client.getStandings(query);
  }
}

export const handballService = new HandballService();

