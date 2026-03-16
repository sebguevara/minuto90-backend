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

export interface GetAflLeaguesQuery {
  id?: number;
  name?: string;
  country?: string;
  season?: number;
  search?: string;
}

export interface GetAflGamesQuery {
  date?: string;
  league?: number;
  season?: number;
  team?: number;
  id?: number;
  timezone?: string;
}

export interface GetAflTeamsQuery {
  id?: number;
  name?: string;
  league?: number;
  season?: number;
}

export interface GetAflStandingsQuery {
  league?: number;
  season?: number;
  team?: number;
}

export interface AflGame extends ApiSportsTimedEvent {
  league: ApiSportsLeagueInfo;
  teams: {
    home: ApiSportsTeamSummary;
    away: ApiSportsTeamSummary;
  };
  scores: {
    home: number | null;
    away: number | null;
  };
  status: ApiSportsStatus;
}

export interface AflTeam {
  id: number;
  name: string;
  logo: string;
  country: ApiSportsCountry;
}

export interface AflStandingRow {
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
    percentage: number;
  };
  form: string;
}

export type AflSeasonsResponse = ApiSportsEnvelope<string[]>;
export type AflLeaguesResponse = ApiSportsListResponse<ApiSportsLeague, GetAflLeaguesQuery>;
export type AflGamesResponse = ApiSportsListResponse<AflGame, GetAflGamesQuery>;
export type AflTeamsResponse = ApiSportsListResponse<AflTeam, GetAflTeamsQuery>;
export type AflStandingsResponse = ApiSportsListResponse<AflStandingRow[], GetAflStandingsQuery>;

