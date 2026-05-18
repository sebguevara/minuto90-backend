import { logInfo, logWarn } from "../../../shared/logging/logger";
import { footballService } from "../../sports/application/football.service";
import type { ApiFootballFixtureItem } from "../../sports/domain/football.types";
import { kickertechBetslipService } from "../../kickertech/application/kickertech-betslip.service";
import { kickertechDiscoveryService } from "../../kickertech/application/kickertech-discovery.service";
import { kickertechOddsService } from "../../kickertech/application/kickertech-odds.service";
import {
  createOddsIntegrationNotFoundError,
  createOddsIntegrationValidationError,
} from "../domain/odds-integration.errors";
import type {
  AvailableOddsResult,
  MainMarketResult,
  MatcherCandidate,
  MatcherFixtureInput,
  OddsLookupResult,
  OddsSource,
  UnavailableOddsResult,
  UnifiedBetslipResult,
} from "../domain/odds-integration.types";
import {
  buildUnifiedFixtureMainMarketCacheKey,
  buildUnifiedFixtureNegativeCacheKey,
  buildUnifiedFixtureOddsCacheKey,
  buildUnifiedFixtureOddsStaleCacheKey,
} from "../infrastructure/odds-integration-cache-key";
import {
  getEventMappingExpiryDate,
  getUnifiedFixtureLiveTtlSeconds,
  getUnifiedFixtureNegativeTtlSeconds,
  getUnifiedFixturePrematchTtlSeconds,
  getUnifiedFixtureStaleTtlSeconds,
} from "../infrastructure/odds-integration-cache-ttl";
import {
  redisOddsIntegrationCacheStore,
  type OddsIntegrationCacheStore,
} from "../infrastructure/odds-integration-cache.store";
import {
  eventMappingRepository,
  type EventMappingRepository,
} from "../infrastructure/event-mapping.repository";
import {
  tournamentMappingRepository,
  type TournamentMappingRepository,
} from "../infrastructure/tournament-mapping.repository";
import {
  eventMatcherService,
  type EventMatcherServiceContract,
} from "./event-matcher.service";
import { selectMainMarket } from "./main-market.selector";

/**
 * Caso de uso central: dado un `apifootball_fixture_id`, devolver las cuotas
 * unificadas listas para el frontend.
 *
 * Flujo (Redis-first en cada paso cacheable):
 *   1. Cache hit del resultado positivo unificado → devolver.
 *   2. Cache hit del resultado negativo → devolver "unavailable".
 *   3. Leer fixture de api-football (vía footballService — ya cacheado allí).
 *   4. Buscar tournament-mapping por leagueId + season. Sin mapping → unavailable.
 *   5. Buscar event-mapping persistido por fixtureId. Si no existe o expiró:
 *        a. Pedir lista de eventos a Kickertech (cacheado por discovery service).
 *        b. Correr el matcher. Si confianza < threshold → unavailable + cache negativo.
 *        c. Persistir event-mapping con confianza, matchedBy y expiresAt.
 *   6. Pedir cuotas detalladas a Kickertech (cacheado en odds service).
 *   7. Construir el resultado unificado y guardar en Redis con TTL según live.
 */
export interface OddsLookupUseCaseDeps {
  cache?: OddsIntegrationCacheStore;
  tournamentMappingRepo?: TournamentMappingRepository;
  eventMappingRepo?: EventMappingRepository;
  matcher?: EventMatcherServiceContract;
  fixtureProvider?: { getFixtureById: (id: number) => Promise<ApiFootballFixtureItem | null> };
  candidateProvider?: {
    getEvents: (
      sportId: number,
      countryId: number,
      tournamentId: number
    ) => Promise<MatcherCandidate[]>;
  };
  oddsProvider?: {
    getEventOdds: (
      sportId: number,
      eventId: number
    ) => Promise<{
      externalEventId: number;
      isLive: boolean;
      startDate: string;
      fetchedAt: string;
      markets: AvailableOddsResult["markets"];
    }>;
  };
  betslipProvider?: typeof kickertechBetslipService;
}

const DEFAULT_SOURCE: OddsSource = "kickertech";

const messageForReason = (reason: UnavailableOddsResult["reason"]): string => {
  switch (reason) {
    case "tournament_not_mapped":
      return "El torneo no tiene cuotas disponibles en este proveedor";
    case "event_not_matched":
      return "No encontramos cuotas para este partido en el proveedor";
    case "no_markets":
      return "El partido no tiene mercados activos en este momento";
  }
};

const buildUnavailable = (
  fixtureId: number,
  reason: UnavailableOddsResult["reason"]
): UnavailableOddsResult => ({
  available: false,
  fixtureId,
  reason,
  message: messageForReason(reason),
});

const toMatcherFixtureInput = (fixture: ApiFootballFixtureItem): MatcherFixtureInput => ({
  fixtureId: fixture.fixture.id,
  date: fixture.fixture.date,
  leagueId: fixture.league.id,
  season: fixture.league.season,
  home: { id: fixture.teams.home.id ?? null, name: fixture.teams.home.name ?? "" },
  away: { id: fixture.teams.away.id ?? null, name: fixture.teams.away.name ?? "" },
});

/** Adapter por defecto: api-football fixture by id. */
const defaultFixtureProvider = {
  async getFixtureById(id: number): Promise<ApiFootballFixtureItem | null> {
    const envelope = await footballService.getFixtures({ id });
    return envelope.response[0] ?? null;
  },
};

const defaultCandidateProvider = {
  async getEvents(sportId: number, countryId: number, tournamentId: number) {
    const events = await kickertechDiscoveryService.getEvents(sportId, countryId, tournamentId);
    return events.map<MatcherCandidate>((event) => ({
      externalEventId: event.id,
      home: event.home,
      away: event.away,
      dateStart: event.dateStart,
    }));
  },
};

const defaultOddsProvider = {
  async getEventOdds(sportId: number, eventId: number) {
    const event = await kickertechOddsService.getEventOdds(sportId, eventId);
    return {
      externalEventId: event.externalEventId,
      isLive: event.isLive,
      startDate: event.startDate,
      fetchedAt: event.fetchedAt,
      markets: event.markets,
    };
  },
};

export class OddsLookupUseCase {
  private readonly cache: OddsIntegrationCacheStore;
  private readonly tournamentRepo: TournamentMappingRepository;
  private readonly eventRepo: EventMappingRepository;
  private readonly matcher: EventMatcherServiceContract;
  private readonly fixtureProvider: NonNullable<OddsLookupUseCaseDeps["fixtureProvider"]>;
  private readonly candidateProvider: NonNullable<OddsLookupUseCaseDeps["candidateProvider"]>;
  private readonly oddsProvider: NonNullable<OddsLookupUseCaseDeps["oddsProvider"]>;
  private readonly betslipProvider: typeof kickertechBetslipService;

  constructor(deps: OddsLookupUseCaseDeps = {}) {
    this.cache = deps.cache ?? redisOddsIntegrationCacheStore;
    this.tournamentRepo = deps.tournamentMappingRepo ?? tournamentMappingRepository;
    this.eventRepo = deps.eventMappingRepo ?? eventMappingRepository;
    this.matcher = deps.matcher ?? eventMatcherService;
    this.fixtureProvider = deps.fixtureProvider ?? defaultFixtureProvider;
    this.candidateProvider = deps.candidateProvider ?? defaultCandidateProvider;
    this.oddsProvider = deps.oddsProvider ?? defaultOddsProvider;
    this.betslipProvider = deps.betslipProvider ?? kickertechBetslipService;
  }

  async getOdds(fixtureId: number): Promise<OddsLookupResult> {
    if (!Number.isInteger(fixtureId) || fixtureId <= 0) {
      throw createOddsIntegrationValidationError(
        "El parámetro fixtureId debe ser un número entero válido"
      );
    }

    const positiveKey = buildUnifiedFixtureOddsCacheKey(fixtureId);
    const positive = await this.cache.get<AvailableOddsResult>(positiveKey);
    if (positive) return positive;

    const negativeKey = buildUnifiedFixtureNegativeCacheKey(fixtureId);
    const negative = await this.cache.get<UnavailableOddsResult>(negativeKey);
    if (negative) return negative;

    try {
      return await this.resolveAndCache(fixtureId);
    } catch (error) {
      const fallback = await this.readStaleOdds(fixtureId);
      if (fallback) {
        logWarn("odds_integration.served_stale_after_failure", {
          fixtureId,
          error: error instanceof Error ? error.message : String(error),
        });
        return fallback;
      }
      throw error;
    }
  }

  private async readStaleOdds(fixtureId: number): Promise<AvailableOddsResult | null> {
    const stale = await this.cache.get<AvailableOddsResult>(
      buildUnifiedFixtureOddsStaleCacheKey(fixtureId)
    );
    if (!stale) return null;
    return { ...stale, stale: true };
  }

  async getMainMarket(fixtureId: number): Promise<MainMarketResult> {
    if (!Number.isInteger(fixtureId) || fixtureId <= 0) {
      throw createOddsIntegrationValidationError(
        "El parámetro fixtureId debe ser un número entero válido"
      );
    }

    const cacheKey = buildUnifiedFixtureMainMarketCacheKey(fixtureId);
    const cached = await this.cache.get<MainMarketResult>(cacheKey);
    if (cached) return cached;

    const odds = await this.getOdds(fixtureId);
    if (!odds.available) {
      // No cacheamos el negativo bajo la clave de "main" — ya está cacheado bajo la principal.
      return odds;
    }

    const main = selectMainMarket(odds.markets);
    if (!main) {
      const noMarkets = buildUnavailable(fixtureId, "no_markets");
      await this.cache.set(cacheKey, noMarkets, getUnifiedFixtureNegativeTtlSeconds());
      return noMarkets;
    }

    const result = {
      available: true as const,
      fixtureId,
      source: odds.source,
      externalEventId: odds.externalEventId,
      matchConfidence: odds.matchConfidence,
      fetchedAt: odds.fetchedAt,
      market: main,
      selections: main.odds,
    };
    const ttl = odds.isLive
      ? getUnifiedFixtureLiveTtlSeconds()
      : getUnifiedFixturePrematchTtlSeconds();
    await this.cache.set(cacheKey, result, ttl);
    return result;
  }

  async getBetslip(fixtureId: number, oddId: number): Promise<UnifiedBetslipResult> {
    const odds = await this.getOdds(fixtureId);
    if (!odds.available) {
      throw createOddsIntegrationNotFoundError(
        "Este partido no tiene cuotas disponibles para apostar",
        { fixtureId }
      );
    }

    // Necesitamos sport+event. El betslipService de kickertech requiere sportId.
    // Lo resolvemos por el cache positivo: guardamos sportId en `source-meta` no-ergonómico.
    // Más simple: buscar mapping persistido por fixtureId.
    const mapping = await this.eventRepo.findByFixtureId(DEFAULT_SOURCE, fixtureId);
    if (!mapping) {
      throw createOddsIntegrationNotFoundError(
        "Este partido no tiene cuotas disponibles para apostar",
        { fixtureId }
      );
    }

    const resolved = await this.betslipProvider.resolveBetslip({
      sportId: mapping.sportId,
      eventId: mapping.externalEventId,
      oddId,
    });

    return {
      fixtureId,
      externalEventId: mapping.externalEventId,
      oddId: resolved.oddId,
      url: resolved.url,
      decimal: resolved.decimal,
      selectionName: resolved.selectionName,
      marketTypeId: resolved.marketTypeId,
      marketTypeName: resolved.marketTypeName,
    };
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  private async resolveAndCache(fixtureId: number): Promise<OddsLookupResult> {
    const fixture = await this.fixtureProvider.getFixtureById(fixtureId);
    if (!fixture) {
      throw createOddsIntegrationNotFoundError("No se encontró el partido solicitado", {
        fixtureId,
      });
    }

    const tournamentMapping = await this.tournamentRepo.findByApifootballLeague(
      DEFAULT_SOURCE,
      fixture.league.id,
      fixture.league.season
    );
    if (!tournamentMapping) {
      const result = buildUnavailable(fixtureId, "tournament_not_mapped");
      await this.cache.set(
        buildUnifiedFixtureNegativeCacheKey(fixtureId),
        result,
        getUnifiedFixtureNegativeTtlSeconds()
      );
      return result;
    }

    let mapping = await this.eventRepo.findByFixtureId(DEFAULT_SOURCE, fixtureId);

    if (!mapping) {
      const candidates = await this.candidateProvider.getEvents(
        tournamentMapping.sportId,
        tournamentMapping.countryId,
        tournamentMapping.tournamentId
      );

      const matchResult = await this.matcher.match({
        source: DEFAULT_SOURCE,
        sportId: tournamentMapping.sportId,
        fixture: toMatcherFixtureInput(fixture),
        candidates,
      });

      if (!matchResult.matched) {
        logInfo("odds_integration.match_failed", {
          fixtureId,
          leagueId: fixture.league.id,
          reason: matchResult.reason,
          bestConfidence: matchResult.bestConfidence,
        });
        const result = buildUnavailable(fixtureId, "event_not_matched");
        await this.cache.set(
          buildUnifiedFixtureNegativeCacheKey(fixtureId),
          result,
          getUnifiedFixtureNegativeTtlSeconds()
        );
        return result;
      }

      const matchDate = new Date(fixture.fixture.date);
      mapping = await this.eventRepo.upsert({
        source: DEFAULT_SOURCE,
        sportId: tournamentMapping.sportId,
        externalEventId: matchResult.externalEventId,
        apifootballFixtureId: fixtureId,
        matchDate,
        confidence: matchResult.confidence,
        matchedBy: matchResult.matchedBy,
        expiresAt: getEventMappingExpiryDate(matchDate),
      });

      logInfo("odds_integration.match_success", {
        fixtureId,
        externalEventId: mapping.externalEventId,
        confidence: matchResult.confidence,
        matchedBy: matchResult.matchedBy,
      });
    }

    let event;
    try {
      event = await this.oddsProvider.getEventOdds(mapping.sportId, mapping.externalEventId);
    } catch (error) {
      logWarn("odds_integration.event_odds_fetch_failed", {
        fixtureId,
        externalEventId: mapping.externalEventId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    if (!event.markets.length) {
      const result = buildUnavailable(fixtureId, "no_markets");
      await this.cache.set(
        buildUnifiedFixtureNegativeCacheKey(fixtureId),
        result,
        getUnifiedFixtureNegativeTtlSeconds()
      );
      return result;
    }

    const unified: AvailableOddsResult = {
      available: true,
      fixtureId,
      source: DEFAULT_SOURCE,
      externalEventId: event.externalEventId,
      isLive: event.isLive,
      startDate: event.startDate,
      matchConfidence: mapping.confidence,
      fetchedAt: event.fetchedAt,
      markets: event.markets,
    };

    const ttl = event.isLive
      ? getUnifiedFixtureLiveTtlSeconds()
      : getUnifiedFixturePrematchTtlSeconds();
    await this.cache.set(buildUnifiedFixtureOddsCacheKey(fixtureId), unified, ttl);
    // Espejo de vida larga para servir como fallback si una llamada futura al
    // proveedor falla. Redis expira el positivo pero conservamos esta copia
    // (24h por defecto) para no dejar el home en blanco ante un hiccup.
    await this.cache.set(
      buildUnifiedFixtureOddsStaleCacheKey(fixtureId),
      unified,
      getUnifiedFixtureStaleTtlSeconds()
    );

    return unified;
  }
}

export const oddsLookupUseCase = new OddsLookupUseCase();
