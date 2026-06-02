import { footballService } from "../../sports/application/football.service";
import { redisFootballCacheStore } from "../../sports/infrastructure/football-cache.store";
import type { ApiFootballFixtureItem } from "../../sports/domain/football.types";
import { logInfo } from "../../../shared/logging/logger";
import { getCalendarConfig, type CalendarConfig } from "../infrastructure/calendar-config";
import { renderCalendar, toIcsUtc } from "../infrastructure/ics-renderer";
import type { CalendarEvent, CalendarEventStatus } from "../domain/calendar.types";

/** Clave de caché del .ics renderizado. Subir el sufijo `vN` si cambia el formato del renderer. */
const CACHE_KEY = "calendar:wc2026:ics:v1";
const UID_DOMAIN = "minuto90score.com";

/** Estados que marcan el partido como cancelado en el calendario. */
const CANCELLED_STATUSES = new Set(["CANC", "ABD", "WO", "AWD"]);
/** Estados que aún no tienen hora/equipos definitivos → TENTATIVE. */
const TENTATIVE_STATUSES = new Set(["TBD", "PST"]);
/** Estados de partido finalizado (para añadir el marcador a la descripción). */
const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);

const mapStatus = (item: ApiFootballFixtureItem): CalendarEventStatus => {
  const short = item.fixture.status.short;
  if (CANCELLED_STATUSES.has(short)) return "CANCELLED";
  // Cruces sin resolver: API-Football devuelve equipos sin id (placeholders del bracket).
  const teamsUnresolved = item.teams.home.id == null || item.teams.away.id == null;
  if (TENTATIVE_STATUSES.has(short) || teamsUnresolved) return "TENTATIVE";
  return "CONFIRMED";
};

const buildSummary = (item: ApiFootballFixtureItem): string => {
  const home = item.teams.home.name?.trim() || "Por definir";
  const away = item.teams.away.name?.trim() || "Por definir";
  return `${home} vs ${away}`;
};

const buildLocation = (item: ApiFootballFixtureItem): string | null => {
  const parts = [item.fixture.venue?.name, item.fixture.venue?.city]
    .map((part) => (part ?? "").trim())
    .filter(Boolean);
  return parts.length ? parts.join(", ") : null;
};

const buildDescription = (item: ApiFootballFixtureItem): string => {
  const lines: string[] = [];
  if (item.league?.round) lines.push(`Ronda: ${item.league.round}`);
  if (FINISHED_STATUSES.has(item.fixture.status.short)) {
    const home = item.goals.home ?? item.score.fulltime.home;
    const away = item.goals.away ?? item.score.fulltime.away;
    if (home != null && away != null) lines.push(`Resultado: ${home}-${away}`);
  }
  return lines.join("\n");
};

const toCalendarEvent = (
  item: ApiFootballFixtureItem,
  cfg: CalendarConfig
): CalendarEvent | null => {
  const start = item.fixture.timestamp;
  if (!Number.isFinite(start) || start <= 0) return null;

  return {
    uid: `worldcup-${cfg.season}-fixture-${item.fixture.id}@${UID_DOMAIN}`,
    dtStartUtc: toIcsUtc(start),
    dtEndUtc: toIcsUtc(start + cfg.eventDurationMinutes * 60),
    summary: buildSummary(item),
    location: buildLocation(item),
    description: buildDescription(item),
    sequence: 0,
    status: mapStatus(item),
  };
};

export interface CalendarServiceContract {
  buildWorldCupCalendar(): Promise<string>;
}

export class CalendarService implements CalendarServiceContract {
  /**
   * Genera (o devuelve cacheado) el feed .ics del Mundial 2026.
   * Reúsa `footballService.getFixtures` (caché/single-flight propios) y cachea el .ics
   * en Redis con TTL corto para no pegarle a API-Football en cada fetch de cada suscriptor.
   */
  async buildWorldCupCalendar(): Promise<string> {
    const cfg = getCalendarConfig();

    const cached = await redisFootballCacheStore.get<string>(CACHE_KEY);
    if (cached) return cached;

    const envelope = await footballService.getFixtures({
      league: cfg.leagueId,
      season: cfg.season,
    });

    const events = (envelope.response ?? [])
      .map((item) => toCalendarEvent(item, cfg))
      .filter((event): event is CalendarEvent => event !== null)
      .sort((a, b) => a.dtStartUtc.localeCompare(b.dtStartUtc));

    const ics = renderCalendar(events, cfg);
    await redisFootballCacheStore.set(CACHE_KEY, ics, cfg.ttlSeconds);
    logInfo("calendar.worldcup.built", { events: events.length });
    return ics;
  }
}

export const calendarService = new CalendarService();
