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

export interface GetNflLeaguesQuery {
  id?: number;
  name?: string;
  country?: string;
  season?: number;
  search?: string;
}

export interface GetNflGamesQuery {
  date?: string;
  league?: number;
  season?: number;
  team?: number;
  id?: number;
  timezone?: string;
}

export interface GetNflTeamsQuery {
  id?: number;
  name?: string;
  league?: number;
  season?: number;
  search?: string;
}

export interface GetNflStandingsQuery {
  league?: number;
  season?: number;
  team?: number;
}

export interface NflGame extends ApiSportsTimedEvent {
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
      overtime: number | null;
      total: number | null;
    };
    away: {
      quarter_1: number | null;
      quarter_2: number | null;
      quarter_3: number | null;
      quarter_4: number | null;
      overtime: number | null;
      total: number | null;
    };
  };
  status: ApiSportsStatus;
}

export interface NflTeam {
  id: number;
  name: string;
  logo: string;
  country: ApiSportsCountry;
}

export interface NflStandingRow {
  position: number;
  team: ApiSportsTeamSummary;
  games: {
    played: number;
    win: { total: number };
    lose: { total: number };
    tie: { total: number };
  };
  points: {
    for: number;
    against: number;
  };
  form: string;
}

export type NflSeasonsResponse = ApiSportsEnvelope<string[]>;
export type NflLeaguesResponse = ApiSportsListResponse<ApiSportsLeague, GetNflLeaguesQuery>;
export type NflGamesResponse = ApiSportsListResponse<NflGame, GetNflGamesQuery>;
export type NflTeamsResponse = ApiSportsListResponse<NflTeam, GetNflTeamsQuery>;
export type NflStandingsResponse = ApiSportsListResponse<NflStandingRow[], GetNflStandingsQuery>;

