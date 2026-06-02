/**
 * Configuración del feed de calendario suscribible (.ics) del Mundial 2026.
 *
 * El feed expone los fixtures de la Copa del Mundo (una liga/temporada de API-Football)
 * como un VCALENDAR al que el teléfono se suscribe (webcal). Todos los valores son
 * configurables por env para ajustar liga/temporada o cadencia de caché sin redeploy.
 */
export interface CalendarConfig {
  /** League id de API-Football para la Copa del Mundo (constante conocida = 1). */
  leagueId: number;
  /** Temporada de API-Football del Mundial 2026. */
  season: number;
  /** TTL (segundos) del .ics renderizado en Redis. */
  ttlSeconds: number;
  /** Duración asumida de cada partido (minutos) para calcular DTEND. */
  eventDurationMinutes: number;
  /** Minutos antes del inicio para el recordatorio (VALARM). 0 = sin alarma. */
  alarmMinutes: number;
  /** Nombre visible del calendario en la app del teléfono. */
  calendarName: string;
}

const DEFAULT_LEAGUE_ID = 1; // World Cup — featured-competitions.constants.ts
const DEFAULT_SEASON = 2026;
const DEFAULT_TTL_SECONDS = 900; // 15 min
const DEFAULT_EVENT_DURATION_MINUTES = 120;
const DEFAULT_ALARM_MINUTES = 60;
const DEFAULT_CALENDAR_NAME = "Mundial 2026";

const toInt = (value: string | undefined, fallback: number): number => {
  const n = Number((value ?? "").trim());
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export const getCalendarConfig = (): CalendarConfig => ({
  leagueId: toInt(process.env.WORLD_CUP_LEAGUE_ID, DEFAULT_LEAGUE_ID),
  season: toInt(process.env.WORLD_CUP_SEASON, DEFAULT_SEASON),
  ttlSeconds: toInt(process.env.CALENDAR_ICS_TTL_SECONDS, DEFAULT_TTL_SECONDS),
  eventDurationMinutes: toInt(
    process.env.CALENDAR_EVENT_DURATION_MINUTES,
    DEFAULT_EVENT_DURATION_MINUTES
  ),
  alarmMinutes: toInt(process.env.CALENDAR_ALARM_MINUTES, DEFAULT_ALARM_MINUTES),
  calendarName: (process.env.CALENDAR_NAME ?? "").trim() || DEFAULT_CALENDAR_NAME,
});
