import type {
  GetMmaFightersQuery,
  GetMmaFightsQuery,
  GetMmaLeaguesQuery,
  MmaFightersResponse,
  MmaFightsResponse,
  MmaLeaguesResponse,
  MmaSeasonsResponse,
} from "../domain/mma.types";
import { mmaApiClient, type MmaApiClientContract } from "../infrastructure/mma-api.client";

export interface MmaServiceContract {
  getSeasons(): Promise<MmaSeasonsResponse>;
  getLeagues(query: GetMmaLeaguesQuery): Promise<MmaLeaguesResponse>;
  getFights(query: GetMmaFightsQuery): Promise<MmaFightsResponse>;
  getFighters(query: GetMmaFightersQuery): Promise<MmaFightersResponse>;
}

export class MmaService implements MmaServiceContract {
  constructor(private readonly client: MmaApiClientContract = mmaApiClient) {}

  getSeasons() {
    return this.client.getSeasons();
  }

  getLeagues(query: GetMmaLeaguesQuery) {
    return this.client.getLeagues(query);
  }

  getFights(query: GetMmaFightsQuery) {
    return this.client.getFights(query);
  }

  getFighters(query: GetMmaFightersQuery) {
    return this.client.getFighters(query);
  }
}

export const mmaService = new MmaService();

