import type {
  BasketballGamesResponse,
  BasketballLeaguesResponse,
  BasketballSeasonsResponse,
  BasketballStandingsResponse,
  BasketballTeamsResponse,
  GetBasketballGamesQuery,
  GetBasketballLeaguesQuery,
  GetBasketballSeasonsQuery,
  GetBasketballStandingsQuery,
  GetBasketballTeamsQuery,
} from "../domain/basketball.types";
import {
  basketballApiClient,
  type BasketballApiClientContract,
} from "../infrastructure/basketball-api.client";

export interface BasketballServiceContract {
  getSeasons(query?: GetBasketballSeasonsQuery): Promise<BasketballSeasonsResponse>;
  getLeagues(query: GetBasketballLeaguesQuery): Promise<BasketballLeaguesResponse>;
  getGames(query: GetBasketballGamesQuery): Promise<BasketballGamesResponse>;
  getTeams(query: GetBasketballTeamsQuery): Promise<BasketballTeamsResponse>;
  getStandings(query: GetBasketballStandingsQuery): Promise<BasketballStandingsResponse>;
}

export class BasketballService implements BasketballServiceContract {
  constructor(private readonly client: BasketballApiClientContract = basketballApiClient) {}

  getSeasons(query?: GetBasketballSeasonsQuery) {
    return this.client.getSeasons(query);
  }

  getLeagues(query: GetBasketballLeaguesQuery) {
    return this.client.getLeagues(query);
  }

  getGames(query: GetBasketballGamesQuery) {
    return this.client.getGames(query);
  }

  getTeams(query: GetBasketballTeamsQuery) {
    return this.client.getTeams(query);
  }

  getStandings(query: GetBasketballStandingsQuery) {
    return this.client.getStandings(query);
  }
}

export const basketballService = new BasketballService();
