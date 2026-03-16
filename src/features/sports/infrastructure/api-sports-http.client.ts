import { logWarn } from "../../../shared/logging/logger";
import {
  createApiSportsConfigurationError,
  createApiSportsUnexpectedError,
  createApiSportsUpstreamError,
} from "../domain/api-sports.errors";
import { buildApiSportsCacheKey, serializeApiSportsParams } from "./api-sports-cache";
import type { ApiSportsCacheStore } from "./api-sports-cache.store";
import { redisApiSportsCacheStore } from "./api-sports-cache.store";

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface ApiSportsHttpClientOptions {
  sport: string;
  sportLabel: string;
  sportCode: string;
  baseUrl: string;
  apiKey: string;
  ttlByEndpoint: Record<string, number>;
  fetchFn?: FetchLike;
  cache?: ApiSportsCacheStore;
}

function normalizeUpstreamBody(body: string) {
  if (!body) return undefined;

  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return { body };
  }
}

function isValidApiSportsPayload(value: unknown) {
  return Array.isArray(value) || (!!value && typeof value === "object");
}

export class ApiSportsHttpClient {
  private readonly sport: string;
  private readonly sportLabel: string;
  private readonly sportCode: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchFn: FetchLike;
  private readonly cache: ApiSportsCacheStore;
  private readonly ttlByEndpoint: Record<string, number>;

  constructor(options: ApiSportsHttpClientOptions) {
    this.sport = options.sport;
    this.sportLabel = options.sportLabel;
    this.sportCode = options.sportCode;
    this.baseUrl = options.baseUrl;
    this.apiKey = options.apiKey;
    this.fetchFn = options.fetchFn ?? fetch;
    this.cache = options.cache ?? redisApiSportsCacheStore;
    this.ttlByEndpoint = options.ttlByEndpoint;
  }

  async request<TResponse>(endpoint: string, params?: object): Promise<TResponse> {
    if (!this.apiKey) {
      throw createApiSportsConfigurationError(this.sportLabel, this.sportCode, { endpoint });
    }

    const cacheKey = buildApiSportsCacheKey(this.sport, endpoint, params);
    const ttlSeconds = this.ttlByEndpoint[endpoint] ?? 0;
    const cached = ttlSeconds > 0 ? await this.cache.get<TResponse>(cacheKey) : null;

    if (cached) {
      return cached;
    }

    const serializedParams = serializeApiSportsParams(params);
    const url = serializedParams
      ? `${this.baseUrl}${endpoint}?${serializedParams}`
      : `${this.baseUrl}${endpoint}`;

    const response = await this.fetchFn(url, {
      method: "GET",
      headers: {
        "x-rapidapi-key": this.apiKey,
        "x-rapidapi-host": new URL(this.baseUrl).host,
      },
    });

    const body = await response.text();

    if (!response.ok) {
      const details = normalizeUpstreamBody(body);

      if (response.status === 429) {
        throw createApiSportsUpstreamError(
          this.sportCode,
          429,
          `La consulta excedio el limite permitido para ${this.sportLabel}`,
          { endpoint, details }
        );
      }

      if (response.status === 401 || response.status === 403) {
        throw createApiSportsUpstreamError(
          this.sportCode,
          response.status,
          `La API de ${this.sportLabel} rechazo las credenciales configuradas`,
          { endpoint, details }
        );
      }

      throw createApiSportsUpstreamError(
        this.sportCode,
        response.status >= 500 ? 503 : 502,
        `No se pudo obtener la informacion de ${this.sportLabel}`,
        { endpoint, upstreamStatus: response.status, details }
      );
    }

    let json: unknown;
    try {
      json = body ? (JSON.parse(body) as unknown) : null;
    } catch {
      throw createApiSportsUnexpectedError(this.sportLabel, this.sportCode, { endpoint, body });
    }

    if (!isValidApiSportsPayload(json)) {
      throw createApiSportsUnexpectedError(this.sportLabel, this.sportCode, {
        endpoint,
        body: json as Record<string, unknown>,
      });
    }

    if (ttlSeconds > 0) {
      await this.cache.set(cacheKey, json, ttlSeconds);
    } else {
      logWarn("api_sports.cache.ttl_missing", { sport: this.sport, endpoint });
    }

    return json as TResponse;
  }
}

