import type {
  ApiSportsCountry,
  ApiSportsEnvelope,
  ApiSportsLeague,
  ApiSportsLeagueInfo,
  ApiSportsListResponse,
  ApiSportsStatus,
  ApiSportsTeamSummary,
  ApiSportsTimedEvent,
} from "./api-sports.shared";

export interface GetBasketballSeasonsQuery {
  search?: string;
}

export interface GetBasketballLeaguesQuery {
  id?: number;
  name?: string;
  country?: string;
  season?: string;
}

export interface GetBasketballGamesQuery {
  date?: string;
  league?: number;
  season?: string;
  team?: number;
  id?: number;
  timezone?: string;
}

export interface GetBasketballTeamsQuery {
  id?: number;
  name?: string;
  league?: number;
  season?: string;
  search?: string;
}

export interface GetBasketballStandingsQuery {
  league?: number;
  season?: string;
  team?: number;
}

export interface BasketballGame extends ApiSportsTimedEvent {
  league: ApiSportsLeagueInfo;
  teams: {
    home: ApiSportsTeamSummary;
    away: ApiSportsTeamSummary;
  };
  scores: {
    home: {
      quarter_1: number | null;
      quarter_2: number | null;
      quarter_3: number | null;
      quarter_4: number | null;
      total: number | null;
    };
    away: {
      quarter_1: number | null;
      quarter_2: number | null;
      quarter_3: number | null;
      quarter_4: number | null;
      total: number | null;
    };
  };
  status: ApiSportsStatus;
}

export interface BasketballTeam {
  id: number;
  name: string;
  logo: string;
  country: ApiSportsCountry;
}

export interface BasketballStandingRow {
  position: number;
  team: ApiSportsTeamSummary;
  games: {
    played: number;
    win: { total: number };
    lose: { total: number };
  };
  points: {
    for: number;
    against: number;
  };
  form: string;
}

export type BasketballSeasonsResponse = ApiSportsEnvelope<string[], GetBasketballSeasonsQuery>;
export type BasketballLeaguesResponse = ApiSportsListResponse<
  ApiSportsLeague,
  GetBasketballLeaguesQuery
>;
export type BasketballGamesResponse = ApiSportsListResponse<
  BasketballGame,
  GetBasketballGamesQuery
>;
export type BasketballTeamsResponse = ApiSportsListResponse<
  BasketballTeam,
  GetBasketballTeamsQuery
>;
export type BasketballStandingsResponse = ApiSportsListResponse<
  BasketballStandingRow[],
  GetBasketballStandingsQuery
>;

