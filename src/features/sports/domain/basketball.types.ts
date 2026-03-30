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

export interface GetBasketballSeasonsQuery {
  search?: string;
}

export interface GetBasketballLeaguesQuery {
  id?: number;
  name?: string;
  country?: string;
  season?: string;
}

export interface GetBasketballGamesQuery {
  date?: string;
  league?: number;
  season?: string;
  team?: number;
  id?: number;
  timezone?: string;
}

export interface GetBasketballTeamsQuery {
  id?: number;
  name?: string;
  league?: number;
  season?: string;
  search?: string;
  country_id?: number;
}

export interface GetBasketballPlayersQuery {
  id?: number;
  season?: string;
  team?: number;
  search?: string;
}

export interface GetBasketballStatisticsQuery {
  league: number;
  season: string;
  team: number;
}

export interface GetBasketballStandingsQuery {
  league?: number;
  season?: string;
  team?: number;
}

export interface BasketballGame extends ApiSportsTimedEvent {
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

export interface BasketballTeam {
  id: number;
  name: string;
  logo: string;
  country: ApiSportsCountry;
}

export interface BasketballPlayer {
  id: number;
  name: string;
  number: string | null;
  country: string | null;
  position: string | null;
  age: number | null;
}

interface BasketballGamePlayed {
  home: number;
  away: number;
  all: number;
}

interface BasketballGameOutcome {
  home: {
    total: number;
    percentage: number | string | null;
  };
  away: {
    total: number;
    percentage: number | string | null;
  };
  all: {
    total: number;
    percentage: number | string | null;
  };
}

interface BasketballPoints {
  total: {
    home: number;
    away: number;
    all: number;
  };
  average: {
    home: number | string | null;
    away: number | string | null;
    all: number | string | null;
  };
}

export interface BasketballTeamStatistics {
  country: ApiSportsCountry;
  league: ApiSportsLeagueInfo & {
    type?: string;
  };
  team: BasketballTeam;
  games: {
    played: BasketballGamePlayed;
    wins: BasketballGameOutcome;
    draws: BasketballGameOutcome;
    loses: BasketballGameOutcome;
  };
  points: {
    for: BasketballPoints;
    against: BasketballPoints;
  };
}

export interface BasketballStandingRow {
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

export type BasketballSeasonsResponse = ApiSportsEnvelope<string[], GetBasketballSeasonsQuery>;
export type BasketballLeaguesResponse = ApiSportsListResponse<
  ApiSportsLeague,
  GetBasketballLeaguesQuery
>;
export type BasketballGamesResponse = ApiSportsListResponse<
  BasketballGame,
  GetBasketballGamesQuery
>;
export type BasketballTeamsResponse = ApiSportsListResponse<
  BasketballTeam,
  GetBasketballTeamsQuery
>;
export type BasketballPlayersResponse = ApiSportsListResponse<
  BasketballPlayer,
  GetBasketballPlayersQuery
>;
export type BasketballStatisticsResponse = ApiSportsListResponse<
  BasketballTeamStatistics,
  GetBasketballStatisticsQuery
>;
export type BasketballStandingsResponse = ApiSportsListResponse<
  BasketballStandingRow[],
  GetBasketballStandingsQuery
>;
