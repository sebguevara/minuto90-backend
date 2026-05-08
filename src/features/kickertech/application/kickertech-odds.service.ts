import { logWarn } from "../../../shared/logging/logger";
import {
  createKickertechNotFoundError,
} from "../domain/kickertech.errors";
import type {
  KickertechEventOdds,
  KickertechMarketTypeCatalogEntry,
  KickertechSportFeed,
} from "../domain/kickertech.types";
import {
  buildEventFeedCacheKey,
  buildMarketsCatalogCacheKey,
  buildSportFeedCacheKey,
} from "../infrastructure/kickertech-cache-key";
import {
  getEventFeedLiveTtlSeconds,
  getEventFeedPrematchTtlSeconds,
  getMarketsCatalogTtlSeconds,
  getSportFeedLiveTtlSeconds,
  getSportFeedPrematchTtlSeconds,
} from "../infrastructure/kickertech-cache-ttl";
import {
  redisKickertechCacheStore,
  type KickertechCacheStore,
} from "../infrastructure/kickertech-cache.store";
import {
  kickertechFeedClient,
  type KickertechFeedClientContract,
} from "../infrastructure/kickertech-feed.client";
import {
  buildSportFeed,
  parseKickertechFeedXml,
} from "../infrastructure/kickertech-xml-parser";

/**
 * Casos de uso de cuotas (feed XML parseado a formato canónico).
 *
 * Política Redis-first:
 *  1. Build cache key.
 *  2. Read Redis. Si existe y TTL vigente → devolver.
 *  3. Si no, llamar al feed XML, parsear, guardar y devolver.
 *
 * El TTL depende del estado live del/los eventos: los eventos en vivo se
 * refrescan más agresivamente.
 */
export interface KickertechOddsServiceContract {
  getSportFeed(sportId: number): Promise<KickertechSportFeed>;
  getEventOdds(sportId: number, eventId: number): Promise<KickertechEventOdds>;
  getMarketsCatalog(sportId: number): Promise<KickertechMarketTypeCatalogEntry[]>;
}

export class KickertechOddsService implements KickertechOddsServiceContract {
  constructor(
    private readonly feedClient: KickertechFeedClientContract = kickertechFeedClient,
    private readonly cache: KickertechCacheStore = redisKickertechCacheStore
  ) {}

  async getSportFeed(sportId: number): Promise<KickertechSportFeed> {
    const cacheKey = buildSportFeedCacheKey(sportId);
    const cached = await this.cache.get<KickertechSportFeed>(cacheKey);
    if (cached) return cached;

    const xml = await this.feedClient.getSportFeedXml(sportId);
    const feed = buildSportFeed(sportId, parseKickertechFeedXml(xml));

    const ttl = feed.events.some((event) => event.isLive)
      ? getSportFeedLiveTtlSeconds()
      : getSportFeedPrematchTtlSeconds();

    await Promise.all([
      this.cache.set(cacheKey, feed, ttl),
      this.cache.set(
        buildMarketsCatalogCacheKey(sportId),
        feed.marketsCatalog,
        getMarketsCatalogTtlSeconds()
      ),
    ]);

    return feed;
  }

  async getEventOdds(sportId: number, eventId: number): Promise<KickertechEventOdds> {
    const cacheKey = buildEventFeedCacheKey(sportId, eventId);
    const cached = await this.cache.get<KickertechEventOdds>(cacheKey);
    if (cached) return cached;

    const xml = await this.feedClient.getEventFeedXml(sportId, eventId);
    const { events } = parseKickertechFeedXml(xml);
    const event = events.find((entry) => entry.externalEventId === eventId) ?? events[0];

    if (!event) {
      logWarn("kickertech.odds.event_not_found_in_feed", { sportId, eventId });
      throw createKickertechNotFoundError("No se encontraron cuotas para el evento solicitado", {
        sportId,
        eventId,
      });
    }

    const ttl = event.isLive
      ? getEventFeedLiveTtlSeconds()
      : getEventFeedPrematchTtlSeconds();

    await this.cache.set(cacheKey, event, ttl);
    return event;
  }

  async getMarketsCatalog(sportId: number): Promise<KickertechMarketTypeCatalogEntry[]> {
    const cacheKey = buildMarketsCatalogCacheKey(sportId);
    const cached = await this.cache.get<KickertechMarketTypeCatalogEntry[]>(cacheKey);
    if (cached) return cached;

    // Como efecto secundario `getSportFeed` repuebla el catálogo en Redis.
    const feed = await this.getSportFeed(sportId);
    return feed.marketsCatalog;
  }
}

export const kickertechOddsService = new KickertechOddsService();
