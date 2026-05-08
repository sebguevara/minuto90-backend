import { logWarn } from "../../../shared/logging/logger";
import {
  createKickertechParseError,
  createKickertechUpstreamError,
} from "../domain/kickertech.errors";
import type {
  KickertechCountry,
  KickertechEventSummary,
  KickertechSport,
  KickertechTournament,
} from "../domain/kickertech.types";
import { getKickertechConfig, type KickertechConfig } from "./kickertech-config";

/**
 * Cliente HTTP para los endpoints de descubrimiento (JSON) de Kickertech.
 * No requiere `configHash`: sólo IP whitelist + URL pública.
 *
 *   1. GET /sports
 *   2. GET /{sportId}/countries
 *   3. GET /{sportId}/{countryIds}/tournaments         (countryIds: "1" o "1,2,3")
 *   4. GET /{sportId}/{countryId}/{tournamentId}/events
 */
export interface KickertechDiscoveryClientContract {
  getSports(): Promise<KickertechSport[]>;
  getCountries(sportId: number): Promise<KickertechCountry[]>;
  getTournaments(sportId: number, countryIds: number[]): Promise<KickertechTournament[]>;
  getEvents(
    sportId: number,
    countryId: number,
    tournamentId: number
  ): Promise<KickertechEventSummary[]>;
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const messageFor = (status: number): string => {
  if (status === 403) return "Kickertech rechazó la conexión: IP no autorizada";
  if (status === 429) return "Se excedió el límite de consultas en Kickertech";
  if (status === 404) return "No se encontraron datos para la consulta realizada";
  if (status >= 500) return "Kickertech no está disponible en este momento";
  return "No se pudo obtener información del proveedor de cuotas";
};

const upstreamStatus = (status: number): number => {
  if (status === 404 || status === 429) return status;
  if (status === 401 || status === 403) return 503;
  if (status >= 500) return 503;
  return 502;
};

export class KickertechDiscoveryClient implements KickertechDiscoveryClientContract {
  private readonly config: KickertechConfig;
  private readonly fetchFn: FetchLike;

  constructor(options?: { config?: KickertechConfig; fetchFn?: FetchLike }) {
    this.config = options?.config ?? getKickertechConfig();
    this.fetchFn = options?.fetchFn ?? fetch;
  }

  getSports() {
    return this.request<KickertechSport[]>("/sports");
  }

  getCountries(sportId: number) {
    return this.request<KickertechCountry[]>(`/${sportId}/countries`);
  }

  getTournaments(sportId: number, countryIds: number[]) {
    const ids = [...new Set(countryIds)].sort((a, b) => a - b).join(",");
    return this.request<KickertechTournament[]>(`/${sportId}/${ids}/tournaments`);
  }

  getEvents(sportId: number, countryId: number, tournamentId: number) {
    return this.request<KickertechEventSummary[]>(
      `/${sportId}/${countryId}/${tournamentId}/events`,
      // Map "date_start" → "dateStart" en el adapter (más abajo).
      (raw) => normalizeEvents(raw)
    );
  }

  private async request<T>(path: string, mapper?: (raw: unknown) => T): Promise<T> {
    const url = `${this.config.discoveryBaseUrl}${path}`;

    const response = await this.fetchTimed(url);

    const text = await response.text();

    if (!response.ok) {
      throw createKickertechUpstreamError(upstreamStatus(response.status), messageFor(response.status), {
        url,
        upstreamStatus: response.status,
        body: text.slice(0, 500),
      });
    }

    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch (error) {
      logWarn("kickertech.discovery.parse_failed", { url });
      throw createKickertechParseError({
        url,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (!Array.isArray(parsed)) {
      throw createKickertechParseError({ url, reason: "expected_array" });
    }

    return mapper ? mapper(parsed) : (parsed as T);
  }

  private async fetchTimed(url: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
    try {
      return await this.fetchFn(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
    } catch (error) {
      throw createKickertechUpstreamError(503, "Kickertech no está disponible en este momento", {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Normaliza el campo `date_start` (snake_case) → `dateStart` (camelCase). */
const normalizeEvents = (raw: unknown): KickertechEventSummary[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      const item = entry as Record<string, unknown>;
      const id = Number(item.id);
      if (!Number.isFinite(id)) return null;
      return {
        id,
        home: typeof item.home === "string" ? item.home.trim() : "",
        away: typeof item.away === "string" ? item.away.trim() : "",
        dateStart: typeof item.date_start === "string" ? item.date_start : "",
      };
    })
    .filter((entry): entry is KickertechEventSummary => entry !== null);
};

export const kickertechDiscoveryClient = new KickertechDiscoveryClient();
