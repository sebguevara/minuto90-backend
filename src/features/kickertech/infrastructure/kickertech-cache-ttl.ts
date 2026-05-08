/**
 * Política de TTLs Kickertech.
 *
 * Centraliza todos los TTL en un único punto, configurable por env.
 * Discovery se cachea fuerte (cambia poco). El feed XML se cachea corto
 * (especialmente en live).
 */

const SECOND = 1;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const readSecondsEnv = (
  name: string,
  fallback: number,
  minSeconds: number,
  maxSeconds: number
): number => {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(Math.max(Math.floor(raw), minSeconds), maxSeconds);
};

export const getSportsListTtlSeconds = (): number =>
  readSecondsEnv("KICKERTECH_TTL_SPORTS_SECONDS", 24 * HOUR, 5 * MINUTE, 7 * DAY);

export const getCountriesTtlSeconds = (): number =>
  readSecondsEnv("KICKERTECH_TTL_COUNTRIES_SECONDS", 12 * HOUR, 5 * MINUTE, 7 * DAY);

export const getTournamentsTtlSeconds = (): number =>
  readSecondsEnv("KICKERTECH_TTL_TOURNAMENTS_SECONDS", 6 * HOUR, 5 * MINUTE, 2 * DAY);

export const getEventsListTtlSeconds = (): number =>
  readSecondsEnv("KICKERTECH_TTL_EVENTS_SECONDS", 10 * MINUTE, 30, 6 * HOUR);

/** Feed completo del deporte cuando no se conoce estado live de cada evento. */
export const getSportFeedPrematchTtlSeconds = (): number =>
  readSecondsEnv("KICKERTECH_TTL_SPORT_FEED_PREMATCH_SECONDS", 3 * MINUTE, 30, 30 * MINUTE);

export const getSportFeedLiveTtlSeconds = (): number =>
  readSecondsEnv("KICKERTECH_TTL_SPORT_FEED_LIVE_SECONDS", 30, 5, 5 * MINUTE);

export const getEventFeedPrematchTtlSeconds = (): number =>
  readSecondsEnv("KICKERTECH_TTL_EVENT_FEED_PREMATCH_SECONDS", 30, 5, 10 * MINUTE);

export const getEventFeedLiveTtlSeconds = (): number =>
  readSecondsEnv("KICKERTECH_TTL_EVENT_FEED_LIVE_SECONDS", 10, 5, 5 * MINUTE);

export const getMarketsCatalogTtlSeconds = (): number =>
  readSecondsEnv("KICKERTECH_TTL_MARKETS_CATALOG_SECONDS", 6 * HOUR, 5 * MINUTE, 2 * DAY);
