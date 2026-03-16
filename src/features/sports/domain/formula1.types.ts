import type {
  ApiSportsListResponse,
  ApiSportsTeamSummary,
} from "./api-sports.shared";

export interface GetFormula1RacesQuery {
  id?: number;
  competition?: number;
  season?: number;
  circuit?: number;
  type?: string;
}

export interface GetFormula1TeamsQuery {
  id?: number;
  name?: string;
  search?: string;
}

export interface GetFormula1DriversQuery {
  id?: number;
  name?: string;
  search?: string;
}

export interface GetFormula1RankingsQuery {
  season: number;
}

export interface Formula1Race {
  id: number;
  competition: {
    id: number;
    name: string;
  };
  circuit: {
    id: number;
    name: string;
    image: string | null;
  };
  season: number;
  type: string;
  status: string;
  date: string;
}

export interface Formula1Team {
  id: number;
  name: string;
  logo: string;
  president: string | null;
  director: string | null;
  technical_manager: string | null;
  engine: string | null;
}

export interface Formula1Driver {
  id: number;
  name: string;
  abbr: string | null;
  number: number | null;
  team: {
    id: number;
    name: string;
  };
  image: string | null;
}

export interface Formula1DriverRanking {
  position: number;
  driver: {
    id: number;
    name: string;
    abbr: string | null;
    number: number | null;
  };
  team: {
    id: number;
    name: string;
  };
  points: number;
  wins: number;
  behind: number;
  season: number;
}

export interface Formula1TeamRanking {
  position: number;
  team: ApiSportsTeamSummary;
  points: number;
  wins: number;
  behind: number;
  season: number;
}

export type Formula1SeasonsResponse = string[];
export type Formula1RacesResponse = ApiSportsListResponse<Formula1Race, GetFormula1RacesQuery>;
export type Formula1TeamsResponse = ApiSportsListResponse<Formula1Team, GetFormula1TeamsQuery>;
export type Formula1DriversResponse = ApiSportsListResponse<
  Formula1Driver,
  GetFormula1DriversQuery
>;
export type Formula1DriverRankingsResponse = ApiSportsListResponse<
  Formula1DriverRanking,
  GetFormula1RankingsQuery
>;
export type Formula1TeamRankingsResponse = ApiSportsListResponse<
  Formula1TeamRanking,
  GetFormula1RankingsQuery
>;
