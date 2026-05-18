/**
 * Generación centralizada de claves Redis para la capa de integración de cuotas.
 * Patrón: `minuto90:odds:{recurso}:{ids}`.
 */
const ROOT = "minuto90:odds";

export const buildUnifiedFixtureOddsCacheKey = (fixtureId: number): string =>
  `${ROOT}:fixture:${fixtureId}`;

/**
 * Espejo del positivo con TTL largo. Se escribe junto al positivo y se usa
 * para servir cuotas "viejas" cuando el proveedor falla, evitando que el home
 * quede en blanco por un hiccup transitorio.
 */
export const buildUnifiedFixtureOddsStaleCacheKey = (fixtureId: number): string =>
  `${ROOT}:fixture:${fixtureId}:stale`;

export const buildUnifiedFixtureMainMarketCacheKey = (fixtureId: number): string =>
  `${ROOT}:fixture:${fixtureId}:main`;

/** Resultado negativo: "no hay match" o "torneo no mapeado". */
export const buildUnifiedFixtureNegativeCacheKey = (fixtureId: number): string =>
  `${ROOT}:fixture:${fixtureId}:unavailable`;

export const buildTournamentMappingByLeagueCacheKey = (
  source: string,
  apifootballLeagueId: number,
  season: number
): string => `${ROOT}:tmap:${source}:league_${apifootballLeagueId}:season_${season}`;

export const buildTeamAliasCacheKey = (
  source: string,
  sportId: number,
  normalizedName: string
): string => `${ROOT}:alias:${source}:sport_${sportId}:${normalizedName}`;
