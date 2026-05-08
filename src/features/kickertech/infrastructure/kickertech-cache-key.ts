/**
 * Generación centralizada de claves Redis para el módulo Kickertech.
 *
 * Patrón: `minuto90:kickertech:{recurso}:{ids...}`
 *
 * No concatenar manualmente fuera de este archivo.
 */

const ROOT = "minuto90:kickertech";

export const buildSportsListCacheKey = (): string => `${ROOT}:sports`;

export const buildCountriesCacheKey = (sportId: number): string =>
  `${ROOT}:countries:sport_${sportId}`;

export const buildTournamentsCacheKey = (sportId: number, countryIds: number[]): string => {
  const sortedKey = [...countryIds].sort((a, b) => a - b).join(",");
  return `${ROOT}:tournaments:sport_${sportId}:countries_${sortedKey}`;
};

export const buildEventsListCacheKey = (
  sportId: number,
  countryId: number,
  tournamentId: number
): string =>
  `${ROOT}:events:sport_${sportId}:country_${countryId}:tournament_${tournamentId}`;

export const buildSportFeedCacheKey = (sportId: number): string =>
  `${ROOT}:feed:sport_${sportId}`;

export const buildEventFeedCacheKey = (sportId: number, eventId: number): string =>
  `${ROOT}:feed:sport_${sportId}:event_${eventId}`;

/** Catálogo de tipos de mercado (resolución de type_id → nombre). */
export const buildMarketsCatalogCacheKey = (sportId: number): string =>
  `${ROOT}:markets-catalog:sport_${sportId}`;
