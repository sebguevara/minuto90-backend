import type {
  ApiSportsCountry,
  ApiSportsLeague,
  ApiSportsLeagueInfo,
  ApiSportsListResponse,
  ApiSportsStatus,
  ApiSportsTeamSummary,
  ApiSportsTimedEvent,
} from "./api-sports.shared";

export interface GetVolleyballLeaguesQuery {
  id?: number;
  name?: string;
  country?: string;
  season?: number;
  search?: string;
}

export interface GetVolleyballGamesQuery {
  date?: string;
  league?: number;
  season?: number;
  team?: number;
  id?: number;
  timezone?: string;
}

export interface GetVolleyballTeamsQuery {
  id?: number;
  name?: string;
  league?: number;
  season?: number;
}

export interface GetVolleyballStandingsQuery {
  league?: number;
  season?: number;
  team?: number;
}

export interface VolleyballGameTeamScores {
  set_1: number | null;
  set_2: number | null;
  set_3: number | null;
  set_4: number | null;
  set_5: number | null;
  total: number | null;
}

export interface VolleyballLeague extends ApiSportsLeague {}

export interface VolleyballGame extends ApiSportsTimedEvent {
  league: ApiSportsLeagueInfo;
  teams: {
    home: ApiSportsTeamSummary;
    away: ApiSportsTeamSummary;
  };
  scores: {
    home: VolleyballGameTeamScores;
    away: VolleyballGameTeamScores;
  };
  status: ApiSportsStatus;
}

export interface VolleyballTeam {
  id: number;
  name: string;
  logo: string;
  country: ApiSportsCountry;
}

export interface VolleyballStandingRow {
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
  sets: {
    won: number;
    lost: number;
    ratio: number;
  };
  form: string;
}

export type VolleyballSeasonsResponse = string[];
export type VolleyballLeaguesResponse = ApiSportsListResponse<
  VolleyballLeague,
  GetVolleyballLeaguesQuery
>;
export type VolleyballGamesResponse = ApiSportsListResponse<
  VolleyballGame,
  GetVolleyballGamesQuery
>;
export type VolleyballTeamsResponse = ApiSportsListResponse<
  VolleyballTeam,
  GetVolleyballTeamsQuery
>;
export type VolleyballStandingsResponse = ApiSportsListResponse<
  VolleyballStandingRow[],
  GetVolleyballStandingsQuery
>;

