import type {
  BasketballGamesResponse,
  BasketballLeaguesResponse,
  BasketballPlayersResponse,
  BasketballSeasonsResponse,
  BasketballStatisticsResponse,
  BasketballStandingsResponse,
  BasketballTeamsResponse,
  GetBasketballGamesQuery,
  GetBasketballLeaguesQuery,
  GetBasketballPlayersQuery,
  GetBasketballSeasonsQuery,
  GetBasketballStatisticsQuery,
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
  getPlayers(query: GetBasketballPlayersQuery): Promise<BasketballPlayersResponse>;
  getStatistics(query: GetBasketballStatisticsQuery): Promise<BasketballStatisticsResponse>;
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

  getPlayers(query: GetBasketballPlayersQuery) {
    return this.client.getPlayers(query);
  }

  getStatistics(query: GetBasketballStatisticsQuery) {
    return this.client.getStatistics(query);
  }

  getStandings(query: GetBasketballStandingsQuery) {
    return this.client.getStandings(query);
  }
}

export const basketballService = new BasketballService();
