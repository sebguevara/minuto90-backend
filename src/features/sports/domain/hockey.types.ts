import type {
  ApiSportsCountry,
  ApiSportsLeague,
  ApiSportsLeagueInfo,
  ApiSportsListResponse,
  ApiSportsStatus,
  ApiSportsTeamSummary,
  ApiSportsTimedEvent,
} from "./api-sports.shared";

export interface GetHockeyLeaguesQuery {
  id?: number;
  name?: string;
  country?: string;
  season?: number;
}

export interface GetHockeyGamesQuery {
  date?: string;
  league?: number;
  season?: number;
  team?: number;
  id?: number;
  timezone?: string;
}

export interface GetHockeyTeamsQuery {
  id?: number;
  name?: string;
  league?: number;
  season?: number;
}

export interface GetHockeyStandingsQuery {
  league?: number;
  season?: number;
  team?: number;
}

export interface HockeyGame extends ApiSportsTimedEvent {
  league: ApiSportsLeagueInfo;
  teams: {
    home: ApiSportsTeamSummary;
    away: ApiSportsTeamSummary;
  };
  scores: {
    home: {
      period_1: number | null;
      period_2: number | null;
      period_3: number | null;
      overtime: number | null;
      penalties: number | null;
      total: number | null;
    };
    away: {
      period_1: number | null;
      period_2: number | null;
      period_3: number | null;
      overtime: number | null;
      penalties: number | null;
      total: number | null;
    };
  };
  status: ApiSportsStatus;
}

export interface HockeyTeam {
  id: number;
  name: string;
  logo: string;
  country: ApiSportsCountry;
}

export interface HockeyStandingRow {
  position: number;
  team: ApiSportsTeamSummary;
  games: {
    played: number;
    win: { total: number };
    lose: { total: number };
    overtime_loss: number;
  };
  points: number;
  goals: {
    for: number;
    against: number;
  };
  form: string;
}

export type HockeySeasonsResponse = string[];
export type HockeyLeaguesResponse = ApiSportsListResponse<ApiSportsLeague, GetHockeyLeaguesQuery>;
export type HockeyGamesResponse = ApiSportsListResponse<HockeyGame, GetHockeyGamesQuery>;
export type HockeyTeamsResponse = ApiSportsListResponse<HockeyTeam, GetHockeyTeamsQuery>;
export type HockeyStandingsResponse = ApiSportsListResponse<
  HockeyStandingRow[],
  GetHockeyStandingsQuery
>;

