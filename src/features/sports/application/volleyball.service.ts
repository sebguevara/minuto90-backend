import type {
  GetVolleyballGamesQuery,
  GetVolleyballLeaguesQuery,
  GetVolleyballStandingsQuery,
  GetVolleyballTeamsQuery,
  VolleyballGamesResponse,
  VolleyballLeaguesResponse,
  VolleyballSeasonsResponse,
  VolleyballStandingsResponse,
  VolleyballTeamsResponse,
} from "../domain/volleyball.types";
import {
  volleyballApiClient,
  type VolleyballApiClientContract,
} from "../infrastructure/volleyball-api.client";

export interface VolleyballServiceContract {
  getSeasons(): Promise<VolleyballSeasonsResponse>;
  getLeagues(query: GetVolleyballLeaguesQuery): Promise<VolleyballLeaguesResponse>;
  getGames(query: GetVolleyballGamesQuery): Promise<VolleyballGamesResponse>;
  getTeams(query: GetVolleyballTeamsQuery): Promise<VolleyballTeamsResponse>;
  getStandings(query: GetVolleyballStandingsQuery): Promise<VolleyballStandingsResponse>;
}

export class VolleyballService implements VolleyballServiceContract {
  constructor(private readonly client: VolleyballApiClientContract = volleyballApiClient) {}

  getSeasons() {
    return this.client.getSeasons();
  }

  getLeagues(query: GetVolleyballLeaguesQuery) {
    return this.client.getLeagues(query);
  }

  getGames(query: GetVolleyballGamesQuery) {
    return this.client.getGames(query);
  }

  getTeams(query: GetVolleyballTeamsQuery) {
    return this.client.getTeams(query);
  }

  getStandings(query: GetVolleyballStandingsQuery) {
    return this.client.getStandings(query);
  }
}

export const volleyballService = new VolleyballService();

