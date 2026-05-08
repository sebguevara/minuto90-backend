import {
  buildCountriesCacheKey,
  buildEventsListCacheKey,
  buildSportsListCacheKey,
  buildTournamentsCacheKey,
} from "../infrastructure/kickertech-cache-key";
import {
  getCountriesTtlSeconds,
  getEventsListTtlSeconds,
  getSportsListTtlSeconds,
  getTournamentsTtlSeconds,
} from "../infrastructure/kickertech-cache-ttl";
import {
  redisKickertechCacheStore,
  type KickertechCacheStore,
} from "../infrastructure/kickertech-cache.store";
import {
  kickertechDiscoveryClient,
  type KickertechDiscoveryClientContract,
} from "../infrastructure/kickertech-discovery.client";
import type {
  KickertechCountry,
  KickertechEventSummary,
  KickertechSport,
  KickertechTournament,
} from "../domain/kickertech.types";

/**
 * Casos de uso del catálogo de descubrimiento Kickertech.
 *
 * Regla obligatoria del proyecto: Redis primero. Si la clave existe y su TTL
 * sigue vigente, se devuelve desde caché. Si no, se consulta el proveedor,
 * se persiste el resultado en Redis con el TTL correspondiente y se devuelve.
 */
export interface KickertechDiscoveryServiceContract {
  getSports(): Promise<KickertechSport[]>;
  getCountries(sportId: number): Promise<KickertechCountry[]>;
  getTournaments(sportId: number, countryIds: number[]): Promise<KickertechTournament[]>;
  getEvents(
    sportId: number,
    countryId: number,
    tournamentId: number
  ): Promise<KickertechEventSummary[]>;
}

export class KickertechDiscoveryService implements KickertechDiscoveryServiceContract {
  constructor(
    private readonly client: KickertechDiscoveryClientContract = kickertechDiscoveryClient,
    private readonly cache: KickertechCacheStore = redisKickertechCacheStore
  ) {}

  async getSports() {
    return this.cached(
      buildSportsListCacheKey(),
      getSportsListTtlSeconds(),
      () => this.client.getSports()
    );
  }

  async getCountries(sportId: number) {
    return this.cached(
      buildCountriesCacheKey(sportId),
      getCountriesTtlSeconds(),
      () => this.client.getCountries(sportId)
    );
  }

  async getTournaments(sportId: number, countryIds: number[]) {
    return this.cached(
      buildTournamentsCacheKey(sportId, countryIds),
      getTournamentsTtlSeconds(),
      () => this.client.getTournaments(sportId, countryIds)
    );
  }

  async getEvents(sportId: number, countryId: number, tournamentId: number) {
    return this.cached(
      buildEventsListCacheKey(sportId, countryId, tournamentId),
      getEventsListTtlSeconds(),
      () => this.client.getEvents(sportId, countryId, tournamentId)
    );
  }

  private async cached<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const cached = await this.cache.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    const fresh = await loader();
    await this.cache.set(key, fresh, ttlSeconds);
    return fresh;
  }
}

export const kickertechDiscoveryService = new KickertechDiscoveryService();
