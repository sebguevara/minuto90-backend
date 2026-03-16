import type {
  ApiSportsCountry,
  ApiSportsLeague,
  ApiSportsLeagueInfo,
  ApiSportsListResponse,
  ApiSportsStatus,
  ApiSportsTeamSummary,
  ApiSportsTimedEvent,
} from "./api-sports.shared";

export interface GetBaseballLeaguesQuery {
  id?: number;
  name?: string;
  country?: string;
  season?: number;
}

export interface GetBaseballGamesQuery {
  date?: string;
  league?: number;
  season?: number;
  team?: number;
  id?: number;
  timezone?: string;
}

export interface GetBaseballTeamsQuery {
  id?: number;
  name?: string;
  league?: number;
  season?: number;
}

export interface GetBaseballStandingsQuery {
  league?: number;
  season?: number;
  team?: number;
}

export interface BaseballGame extends ApiSportsTimedEvent {
  league: ApiSportsLeagueInfo;
  teams: {
    home: ApiSportsTeamSummary;
    away: ApiSportsTeamSummary;
  };
  scores: {
    home: {
      innings: Record<string, number | null>;
      total: number | null;
    };
    away: {
      innings: Record<string, number | null>;
      total: number | null;
    };
  };
  status: ApiSportsStatus;
}

export interface BaseballTeam {
  id: number;
  name: string;
  logo: string;
  country: ApiSportsCountry;
}

export interface BaseballStandingRow {
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

export type BaseballSeasonsResponse = string[];
export type BaseballLeaguesResponse = ApiSportsListResponse<
  ApiSportsLeague,
  GetBaseballLeaguesQuery
>;
export type BaseballGamesResponse = ApiSportsListResponse<BaseballGame, GetBaseballGamesQuery>;
export type BaseballTeamsResponse = ApiSportsListResponse<BaseballTeam, GetBaseballTeamsQuery>;
export type BaseballStandingsResponse = ApiSportsListResponse<
  BaseballStandingRow[],
  GetBaseballStandingsQuery
>;

