/**
 * Modelos canónicos del módulo de integración de cuotas.
 *
 * Este módulo une dos fuentes:
 *  - api-football (catálogo de fixtures, ligas, equipos): la fuente de verdad de "qué partidos existen".
 *  - kickertech (cuotas y mercados): la fuente de "qué cuotas hay para ese partido".
 *
 * El frontend consume esta capa, nunca el feed crudo de Kickertech.
 */
import type {
  KickertechMarket,
  KickertechOdd,
} from "../../kickertech/domain/kickertech.types";

/** Identificador del proveedor externo. Hoy sólo "kickertech". */
export type OddsSource = "kickertech";

export interface OddsTournamentMappingRecord {
  id: string;
  source: OddsSource;
  sportId: number;
  countryId: number;
  tournamentId: number;
  apifootballLeagueId: number;
  apifootballSeason: number | null;
  status: "suggested" | "confirmed" | "rejected";
  confidence: number | null;
  notes: string | null;
  verifiedBy: string | null;
}

export interface OddsEventMappingRecord {
  id: string;
  source: OddsSource;
  sportId: number;
  externalEventId: number;
  apifootballFixtureId: number;
  matchDate: Date;
  confidence: number;
  status: "auto" | "verified" | "rejected";
  matchedBy: "exact" | "alias" | "fuzzy" | "manual";
  expiresAt: Date;
}

export interface OddsTeamAliasRecord {
  id: string;
  source: OddsSource;
  sportId: number;
  externalName: string;
  normalizedName: string;
  apifootballTeamId: number;
  confidence: number;
  verifiedBy: string | null;
}

export type OddsAvailability = "available" | "tournament_not_mapped" | "event_not_matched" | "no_markets";

/** Reason para "no available" + metadatos para que el front muestre algo razonable. */
export interface UnavailableOddsResult {
  available: false;
  fixtureId: number;
  reason: Exclude<OddsAvailability, "available">;
  message: string;
}

/** Resultado positivo: cuotas listas para mostrar al usuario. */
export interface AvailableOddsResult {
  available: true;
  fixtureId: number;
  source: OddsSource;
  externalEventId: number;
  isLive: boolean;
  startDate: string;
  /** Confianza del mapping (0..1). El front puede usarla para advertir. */
  matchConfidence: number;
  fetchedAt: string;
  markets: KickertechMarket[];
  /**
   * URL final del betslip (sin placeholder); el frontend NO la necesita por defecto.
   * Para abrir un odd se usa el endpoint dedicado de betslip que valida el oddId.
   */
}

export type OddsLookupResult = AvailableOddsResult | UnavailableOddsResult;

/** Mercado principal por deporte (1X2 / moneyline). */
export interface MainMarketSummary {
  available: true;
  fixtureId: number;
  source: OddsSource;
  externalEventId: number;
  matchConfidence: number;
  fetchedAt: string;
  market: KickertechMarket;
  selections: KickertechOdd[];
}

export type MainMarketResult = MainMarketSummary | UnavailableOddsResult;

/** Resolución del betslip (URL final ya sustituida + metadatos del odd). */
export interface UnifiedBetslipResult {
  fixtureId: number;
  externalEventId: number;
  oddId: number;
  url: string;
  decimal: number;
  selectionName: string;
  marketTypeId: number;
  marketTypeName: string | null;
}

/** Entrada para el matcher. Aplanada para facilitar testeo y desacoplar de api-football. */
export interface MatcherFixtureInput {
  fixtureId: number;
  date: string;
  leagueId: number;
  season: number;
  home: { id: number | null; name: string };
  away: { id: number | null; name: string };
}

export interface MatcherCandidate {
  externalEventId: number;
  home: string;
  away: string;
  dateStart: string;
}

export interface MatcherSuccess {
  matched: true;
  externalEventId: number;
  confidence: number;
  matchedBy: "exact" | "alias" | "fuzzy";
  homeScore: number;
  awayScore: number;
  timeScore: number;
  /** Si los candidatos invirtieron home/away, el matcher lo detectó. */
  reversed: boolean;
}

export interface MatcherFailure {
  matched: false;
  /** Mejor candidato considerado (informativo). */
  bestCandidateId?: number;
  bestConfidence: number;
  reason: "no_candidates_in_time_window" | "below_threshold";
}

export type MatcherResult = MatcherSuccess | MatcherFailure;
