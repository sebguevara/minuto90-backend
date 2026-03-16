import type {
  ApiSportsCountry,
  ApiSportsLeague,
  ApiSportsLeagueInfo,
  ApiSportsListResponse,
  ApiSportsStatus,
  ApiSportsTeamSummary,
  ApiSportsTimedEvent,
} from "./api-sports.shared";

export interface GetHandballLeaguesQuery {
  id?: number;
  name?: string;
  country?: string;
  season?: number;
  search?: string;
}

export interface GetHandballGamesQuery {
  date?: string;
  league?: number;
  season?: number;
  team?: number;
  id?: number;
  timezone?: string;
}

export interface GetHandballTeamsQuery {
  id?: number;
  name?: string;
  league?: number;
  season?: number;
}

export interface GetHandballStandingsQuery {
  league?: number;
  season?: number;
  team?: number;
}

export interface HandballGame extends ApiSportsTimedEvent {
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

export interface HandballTeam {
  id: number;
  name: string;
  logo: string;
  country: ApiSportsCountry;
}

export interface HandballStandingRow {
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
  form: string;
}

export type HandballSeasonsResponse = string[];
export type HandballLeaguesResponse = ApiSportsListResponse<
  ApiSportsLeague,
  GetHandballLeaguesQuery
>;
export type HandballGamesResponse = ApiSportsListResponse<HandballGame, GetHandballGamesQuery>;
export type HandballTeamsResponse = ApiSportsListResponse<HandballTeam, GetHandballTeamsQuery>;
export type HandballStandingsResponse = ApiSportsListResponse<
  HandballStandingRow[],
  GetHandballStandingsQuery
>;

