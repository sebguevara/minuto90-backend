import { ApiSportsHttpClient } from "./api-sports-http.client";
import type {
  GetMmaFightersQuery,
  GetMmaFightsQuery,
  GetMmaLeaguesQuery,
  MmaFightersResponse,
  MmaFightsResponse,
  MmaLeaguesResponse,
  MmaSeasonsResponse,
} from "../domain/mma.types";

const MMA_API_URL = process.env.MMA_API_URL ?? "https://v1.mma.api-sports.io";
const MMA_API_KEY = process.env.MMA_API_KEY ?? process.env.API_KEY ?? "";

const TTL_BY_ENDPOINT: Record<string, number> = {
  "/seasons": 60 * 60 * 24,
  "/leagues": 60 * 60 * 12,
  "/fights": 60,
  "/games": 60,
  "/fighters": 60 * 60,
};

export interface MmaApiClientContract {
  getSeasons(): Promise<MmaSeasonsResponse>;
  getLeagues(query: GetMmaLeaguesQuery): Promise<MmaLeaguesResponse>;
  getFights(query: GetMmaFightsQuery): Promise<MmaFightsResponse>;
  getFighters(query: GetMmaFightersQuery): Promise<MmaFightersResponse>;
  request<TResponse = unknown>(endpoint: string, query?: Record<string, unknown>): Promise<TResponse>;
}

export class MmaApiClient implements MmaApiClientContract {
  private readonly httpClient = new ApiSportsHttpClient({
    sport: "mma",
    sportLabel: "MMA",
    sportCode: "MMA",
    baseUrl: MMA_API_URL,
    apiKey: MMA_API_KEY,
    ttlByEndpoint: TTL_BY_ENDPOINT,
  });

  getSeasons() {
    return this.httpClient.request<MmaSeasonsResponse>("/seasons");
  }

  getLeagues(query: GetMmaLeaguesQuery) {
    return this.httpClient.request<MmaLeaguesResponse>("/leagues", query);
  }

  getFights(query: GetMmaFightsQuery) {
    return this.httpClient.request<MmaFightsResponse>("/fights", query);
  }

  getFighters(query: GetMmaFightersQuery) {
    return this.httpClient.request<MmaFightersResponse>("/fighters", query);
  }

  request<TResponse = unknown>(endpoint: string, query?: Record<string, unknown>) {
    return this.httpClient.request<TResponse>(endpoint, query);
  }
}

export const mmaApiClient = new MmaApiClient();
