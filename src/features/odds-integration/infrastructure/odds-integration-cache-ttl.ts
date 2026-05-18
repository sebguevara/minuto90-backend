/**
 * Política central de TTLs de la capa de integración de cuotas.
 *
 * Hereda los TTL del feed Kickertech para los positivos (live ~30s, prematch ~3min).
 * Los negativos viven más tiempo para no martillar el matcher con cada request.
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

export const getUnifiedFixtureLiveTtlSeconds = (): number =>
  readSecondsEnv("ODDS_INTEGRATION_TTL_LIVE_SECONDS", 30, 5, 5 * MINUTE);

export const getUnifiedFixturePrematchTtlSeconds = (): number =>
  readSecondsEnv("ODDS_INTEGRATION_TTL_PREMATCH_SECONDS", 3 * MINUTE, 30, 30 * MINUTE);

/**
 * TTL del espejo `:stale`. Se escribe junto al positivo y sirve de fallback
 * cuando el proveedor falla. 24h por defecto: lo suficiente para sobrevivir
 * caídas transitorias sin mostrar líneas de hace varios días.
 */
export const getUnifiedFixtureStaleTtlSeconds = (): number =>
  readSecondsEnv("ODDS_INTEGRATION_TTL_STALE_SECONDS", 24 * HOUR, HOUR, 7 * DAY);

/** Cache negativo: "no hay match" o "torneo no mapeado". */
export const getUnifiedFixtureNegativeTtlSeconds = (): number =>
  readSecondsEnv("ODDS_INTEGRATION_TTL_NEGATIVE_SECONDS", 10 * MINUTE, MINUTE, 6 * HOUR);

export const getTournamentMappingTtlSeconds = (): number =>
  readSecondsEnv("ODDS_INTEGRATION_TTL_TMAP_SECONDS", 12 * HOUR, 5 * MINUTE, 7 * DAY);

export const getTeamAliasTtlSeconds = (): number =>
  readSecondsEnv("ODDS_INTEGRATION_TTL_ALIAS_SECONDS", 24 * HOUR, 5 * MINUTE, 7 * DAY);

/**
 * Vencimiento del mapping de evento persistido.
 * Por defecto: kickoff + 4h.
 */
export const getEventMappingExpiryDate = (matchDate: Date): Date => {
  const extraHours = readSecondsEnv(
    "ODDS_INTEGRATION_EVENT_MAPPING_HOURS_AFTER_KICKOFF",
    4,
    1,
    24
  );
  return new Date(matchDate.getTime() + extraHours * HOUR * 1000);
};
