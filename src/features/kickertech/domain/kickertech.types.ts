/**
 * Tipos canónicos del módulo Kickertech.
 *
 * Estos modelos son la representación interna desacoplada del XML/JSON crudo
 * de Kickertech. Todo el resto del backend (use cases, presentación) trabaja
 * sólo con estos tipos.
 */

export interface KickertechSport {
  id: number;
  name: string;
}

export interface KickertechCountry {
  id: number;
  name: string;
}

export interface KickertechTournament {
  id: number;
  name: string;
}

export interface KickertechEventSummary {
  id: number;
  home: string;
  /** Vacío en outrights (apuestas a ganador de torneo). */
  away: string;
  /** ISO 8601 UTC. */
  dateStart: string;
}

export interface KickertechOdd {
  id: number;
  name: string;
  decimal: number;
  /** Formato fraccional británico (ej "17/20"). Puede no venir. */
  fractional: string | null;
  /** Parámetro del mercado (handicap/total). 0 cuando no aplica. */
  value: number;
}

export interface KickertechMarket {
  typeId: number;
  /** Resuelto contra el catálogo `<Markets>` del XML. */
  typeName: string | null;
  odds: KickertechOdd[];
}

/**
 * Estructura aplanada por evento — formato canónico que consume el frontend.
 */
export interface KickertechEventOdds {
  source: "kickertech";
  externalEventId: number;
  sportId: number;
  sportName: string;
  countryId: number;
  countryName: string;
  tournamentId: number;
  tournamentName: string;
  startDate: string;
  isLive: boolean;
  /** ID de evento hermano (prematch/live, regular/full). null si no hay. */
  linkedEventId: number | null;
  home: string;
  away: string;
  /** URL con placeholder #ODD_ID. No exponer cruda al frontend. */
  betslipTemplate: string;
  markets: KickertechMarket[];
  /** Timestamp de cuándo se obtuvo del proveedor. ISO 8601. */
  fetchedAt: string;
}

export interface KickertechMarketTypeCatalogEntry {
  typeId: number;
  sportId: number;
  name: string;
}

export interface KickertechSportFeed {
  sportId: number;
  events: KickertechEventOdds[];
  marketsCatalog: KickertechMarketTypeCatalogEntry[];
  fetchedAt: string;
}
