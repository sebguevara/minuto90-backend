import type {
  ApiSportsEnvelope,
  ApiSportsLeague,
  ApiSportsLeagueInfo,
  ApiSportsListResponse,
  ApiSportsStatus,
  ApiSportsTeamSummary,
  ApiSportsTimedEvent,
} from "./api-sports.shared";

export interface GetMmaLeaguesQuery {
  id?: number;
  name?: string;
  search?: string;
}

export interface GetMmaFightsQuery {
  date?: string;
  league?: number;
  season?: number;
  id?: number;
  fighter?: number;
  status?: string;
}

export interface GetMmaFightersQuery {
  id?: number;
  name?: string;
  search?: string;
}

export interface MmaFight extends ApiSportsTimedEvent {
  league: ApiSportsLeagueInfo;
  fighters: {
    first: ApiSportsTeamSummary;
    second: ApiSportsTeamSummary;
  };
  scores: {
    first: string | null;
    second: string | null;
  };
  status: ApiSportsStatus;
}

export interface MmaFighter {
  id: number;
  name: string;
  nickname: string | null;
  weight: string | null;
  height: string | null;
  reach: string | null;
  stance: string | null;
  birth_date: string | null;
  photo: string | null;
}

export type MmaSeasonsResponse = ApiSportsEnvelope<string[]>;
export type MmaLeaguesResponse = ApiSportsListResponse<ApiSportsLeague, GetMmaLeaguesQuery>;
export type MmaFightsResponse = ApiSportsListResponse<MmaFight, GetMmaFightsQuery>;
export type MmaFightersResponse = ApiSportsListResponse<MmaFighter, GetMmaFightersQuery>;

