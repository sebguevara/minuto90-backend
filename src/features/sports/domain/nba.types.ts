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

export interface GetNbaSeasonsQuery {
  search?: string;
}

export interface GetNbaLeaguesQuery {
  id?: number;
  name?: string;
  country?: string;
  season?: string;
}

export interface GetNbaGamesQuery {
  date?: string;
  league?: number;
  season?: string;
  team?: number;
  id?: number;
  timezone?: string;
}

export interface GetNbaTeamsQuery {
  id?: number;
  name?: string;
  league?: number;
  season?: string;
  search?: string;
}

export interface GetNbaStandingsQuery {
  league?: number;
  season?: string;
  team?: number;
}

export interface NbaGame extends ApiSportsTimedEvent {
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

export interface NbaTeam {
  id: number;
  name: string;
  logo: string;
  country: ApiSportsCountry;
}

export interface NbaStandingRow {
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

export type NbaSeasonsResponse = ApiSportsEnvelope<string[], GetNbaSeasonsQuery>;
export type NbaLeaguesResponse = ApiSportsListResponse<ApiSportsLeague, GetNbaLeaguesQuery>;
export type NbaGamesResponse = ApiSportsListResponse<NbaGame, GetNbaGamesQuery>;
export type NbaTeamsResponse = ApiSportsListResponse<NbaTeam, GetNbaTeamsQuery>;
export type NbaStandingsResponse = ApiSportsListResponse<NbaStandingRow[], GetNbaStandingsQuery>;

