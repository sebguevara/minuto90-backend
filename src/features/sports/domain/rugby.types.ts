import type {
  ApiSportsCountry,
  ApiSportsLeague,
  ApiSportsLeagueInfo,
  ApiSportsListResponse,
  ApiSportsStatus,
  ApiSportsTeamSummary,
  ApiSportsTimedEvent,
} from "./api-sports.shared";

export interface GetRugbyLeaguesQuery {
  id?: number;
  name?: string;
  country?: string;
  season?: number;
}

export interface GetRugbyGamesQuery {
  date?: string;
  league?: number;
  season?: number;
  team?: number;
  id?: number;
  timezone?: string;
}

export interface GetRugbyTeamsQuery {
  id?: number;
  name?: string;
  league?: number;
  season?: number;
}

export interface GetRugbyStandingsQuery {
  league?: number;
  season?: number;
  team?: number;
}

export interface RugbyLeague extends ApiSportsLeague {}

export interface RugbyGame extends ApiSportsTimedEvent {
  league: ApiSportsLeagueInfo;
  teams: {
    home: ApiSportsTeamSummary;
    away: ApiSportsTeamSummary;
  };
  scores: {
    home: {
      first_half: number | null;
      second_half: number | null;
      total: number | null;
    };
    away: {
      first_half: number | null;
      second_half: number | null;
      total: number | null;
    };
  };
  status: ApiSportsStatus;
}

export interface RugbyTeam {
  id: number;
  name: string;
  logo: string;
  country: ApiSportsCountry;
}

export interface RugbyStandingRow {
  position: number;
  team: ApiSportsTeamSummary;
  games: {
    played: number;
    win: { total: number };
    lose: { total: number };
    draw: { total: number };
  };
  points: {
    for: number;
    against: number;
  };
  bonus: number;
  form: string;
}

export type RugbySeasonsResponse = string[];
export type RugbyLeaguesResponse = ApiSportsListResponse<RugbyLeague, GetRugbyLeaguesQuery>;
export type RugbyGamesResponse = ApiSportsListResponse<RugbyGame, GetRugbyGamesQuery>;
export type RugbyTeamsResponse = ApiSportsListResponse<RugbyTeam, GetRugbyTeamsQuery>;
export type RugbyStandingsResponse = ApiSportsListResponse<
  RugbyStandingRow[],
  GetRugbyStandingsQuery
>;

