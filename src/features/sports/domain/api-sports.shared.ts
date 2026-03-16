export type ApiSportsScalar = string | number | boolean;

export type ApiSportsErrorBag = string[] | Record<string, string>;

export interface ApiSportsPaging {
  current: number;
  total: number;
}

export type ApiSportsParameters<TParameters extends object> = {
  [K in keyof TParameters]?: string;
} & Record<string, string | undefined>;

export interface ApiSportsEnvelope<
  TResponse,
  TParameters extends object = Record<string, unknown>,
> {
  get?: string;
  parameters?: ApiSportsParameters<TParameters> | [];
  errors?: ApiSportsErrorBag;
  results?: number;
  paging?: ApiSportsPaging;
  response: TResponse;
}

export interface ApiSportsCountry {
  id?: number | null;
  name: string;
  code: string | null;
  flag: string | null;
}

export interface ApiSportsLeague {
  id: number;
  name: string;
  type: string;
  logo: string;
}

export interface ApiSportsLeagueInfo {
  id: number;
  name: string;
  season: string;
  logo?: string | null;
}

export interface ApiSportsTeamSummary {
  id: number;
  name: string;
  logo: string;
}

export interface ApiSportsStatus {
  long: string;
  short: string;
}

export interface ApiSportsTimedEvent {
  id: number;
  date: string;
  time: string;
  timezone: string;
}

export interface ApiSportsListResponse<TItem, TParameters extends object = Record<string, unknown>>
  extends ApiSportsEnvelope<TItem[], TParameters> {}

