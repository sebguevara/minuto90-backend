import { XMLParser } from "fast-xml-parser";

import { createKickertechParseError } from "../domain/kickertech.errors";
import type {
  KickertechEventOdds,
  KickertechMarket,
  KickertechMarketTypeCatalogEntry,
  KickertechOdd,
  KickertechSportFeed,
} from "../domain/kickertech.types";

/**
 * Parser del feed XML de Kickertech (namespace Sbx).
 *
 * Convierte la estructura anidada `Sbx → Sports → Sport → Country → Tournament → Event → Market → Odd`
 * + el catálogo plano `Sbx → Markets → Market` en una lista canónica de eventos
 * con sus mercados ya resueltos por nombre.
 */

interface ParsedSbxRoot {
  Sbx?: {
    Sports?: { Sport?: unknown };
    Markets?: { Market?: unknown };
  };
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
  allowBooleanAttributes: false,
});

const toArray = <T>(value: T | T[] | undefined | null): T[] => {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
};

const toInt = (value: unknown, fallback = 0): number => {
  if (typeof value === "number") return Number.isFinite(value) ? Math.trunc(value) : fallback;
  if (typeof value !== "string") return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toFloat = (value: unknown, fallback = 0): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value !== "string") return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toStr = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const toBool01 = (value: unknown): boolean => {
  if (typeof value === "string") return value.trim() === "1" || value.trim().toLowerCase() === "true";
  if (typeof value === "number") return value === 1;
  if (typeof value === "boolean") return value;
  return false;
};

const buildMarketsCatalog = (rawCatalog: unknown): {
  byTypeId: Map<number, string>;
  list: KickertechMarketTypeCatalogEntry[];
} => {
  const items = toArray(rawCatalog);
  const list: KickertechMarketTypeCatalogEntry[] = [];
  const byTypeId = new Map<number, string>();

  for (const entry of items) {
    const item = entry as Record<string, unknown>;
    const typeId = toInt(item.type_id);
    if (!typeId) continue;
    const name = toStr(item.name);
    list.push({ typeId, sportId: toInt(item.sport_id), name });
    byTypeId.set(typeId, name);
  }

  return { byTypeId, list };
};

const buildOdd = (raw: unknown): KickertechOdd | null => {
  const item = raw as Record<string, unknown>;
  const id = toInt(item.id);
  if (!id) return null;
  const fractional = toStr(item.price);
  return {
    id,
    name: toStr(item.name),
    decimal: toFloat(item.decimal),
    fractional: fractional || null,
    value: toFloat(item.value),
  };
};

const buildMarket = (raw: unknown, catalog: Map<number, string>): KickertechMarket | null => {
  const item = raw as Record<string, unknown>;
  const typeId = toInt(item.type_id);
  if (!typeId) return null;
  const odds = toArray(item.Odd)
    .map((odd) => buildOdd(odd))
    .filter((odd): odd is KickertechOdd => odd !== null);
  return {
    typeId,
    typeName: catalog.get(typeId) ?? null,
    odds,
  };
};

interface EventContext {
  sportId: number;
  sportName: string;
  countryId: number;
  countryName: string;
  tournamentId: number;
  tournamentName: string;
}

const buildEvent = (
  raw: unknown,
  ctx: EventContext,
  catalog: Map<number, string>,
  fetchedAt: string
): KickertechEventOdds | null => {
  const item = raw as Record<string, unknown>;
  const id = toInt(item.id);
  if (!id) return null;

  const linkedEventId = toInt(item.linked_event_id);
  const markets = toArray(item.Market)
    .map((market) => buildMarket(market, catalog))
    .filter((market): market is KickertechMarket => market !== null);

  return {
    source: "kickertech",
    externalEventId: id,
    sportId: ctx.sportId,
    sportName: ctx.sportName,
    countryId: ctx.countryId,
    countryName: ctx.countryName,
    tournamentId: ctx.tournamentId,
    tournamentName: ctx.tournamentName,
    startDate: toStr(item.start_date),
    isLive: toBool01(item.is_live),
    linkedEventId: linkedEventId ? linkedEventId : null,
    home: toStr(item.home),
    away: toStr(item.away),
    betslipTemplate: toStr(item.betslip),
    markets,
    fetchedAt,
  };
};

export interface ParseSportFeedResult {
  events: KickertechEventOdds[];
  marketsCatalog: KickertechMarketTypeCatalogEntry[];
}

export const parseKickertechFeedXml = (xml: string): ParseSportFeedResult => {
  if (!xml || typeof xml !== "string") {
    throw createKickertechParseError({ reason: "empty_xml" });
  }

  let parsed: ParsedSbxRoot;
  try {
    parsed = xmlParser.parse(xml) as ParsedSbxRoot;
  } catch (error) {
    throw createKickertechParseError({
      reason: "xml_parse_failure",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const root = parsed.Sbx;
  if (!root) {
    throw createKickertechParseError({ reason: "missing_sbx_root" });
  }

  const fetchedAt = new Date().toISOString();
  const { byTypeId, list: marketsCatalog } = buildMarketsCatalog(root.Markets?.Market);

  const events: KickertechEventOdds[] = [];

  for (const sportNode of toArray(root.Sports?.Sport)) {
    const sport = sportNode as Record<string, unknown>;
    const sportId = toInt(sport.id);
    const sportName = toStr(sport.name);

    for (const countryNode of toArray(sport.Country)) {
      const country = countryNode as Record<string, unknown>;
      const countryId = toInt(country.id);
      const countryName = toStr(country.name);

      for (const tournamentNode of toArray(country.Tournament)) {
        const tournament = tournamentNode as Record<string, unknown>;
        const tournamentId = toInt(tournament.id);
        const tournamentName = toStr(tournament.name);

        for (const eventNode of toArray(tournament.Event)) {
          const event = buildEvent(
            eventNode,
            { sportId, sportName, countryId, countryName, tournamentId, tournamentName },
            byTypeId,
            fetchedAt
          );
          if (event) events.push(event);
        }
      }
    }
  }

  return { events, marketsCatalog };
};

export const buildSportFeed = (
  sportId: number,
  parseResult: ParseSportFeedResult
): KickertechSportFeed => ({
  sportId,
  events: parseResult.events,
  marketsCatalog: parseResult.marketsCatalog,
  fetchedAt: new Date().toISOString(),
});
