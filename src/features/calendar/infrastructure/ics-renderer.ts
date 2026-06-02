import type { CalendarEvent } from "../domain/calendar.types";
import type { CalendarConfig } from "./calendar-config";

/** RFC 5545 exige terminar las líneas con CRLF. */
const CRLF = "\r\n";

/** Convierte segundos Unix (UTC) a fecha iCalendar UTC básica: `YYYYMMDDTHHMMSSZ`. */
export const toIcsUtc = (unixSeconds: number): string =>
  new Date(unixSeconds * 1000)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

/** DTSTAMP: marca de generación, mismo formato básico UTC. */
const nowStamp = (): string =>
  new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Escapa texto según RFC 5545: backslash, punto y coma, coma y saltos de línea. */
export const escapeText = (value: string): string =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\n|\r/g, "\\n");

/**
 * Plegado de líneas a 75 octetos (RFC 5545): las continuaciones empiezan con un espacio.
 * Se cuenta en bytes UTF-8 para no partir un carácter multibyte (acentos, ñ).
 */
export const foldLine = (line: string): string => {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const chunks: string[] = [];
  let start = 0;
  // Primera línea: 75 octetos. Continuaciones: 74 (1 octeto reservado para el espacio inicial).
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // No partir un carácter UTF-8: retroceder mientras el byte sea de continuación (10xxxxxx).
    while (end < bytes.length && (bytes[end]! & 0xc0) === 0x80) {
      end -= 1;
    }
    chunks.push(bytes.subarray(start, end).toString("utf8"));
    start = end;
    limit = 74;
  }
  return chunks.join(`${CRLF} `);
};

const line = (key: string, value: string): string => foldLine(`${key}:${value}`);

export const renderEvent = (event: CalendarEvent, cfg: CalendarConfig): string => {
  const lines: string[] = ["BEGIN:VEVENT"];
  lines.push(line("UID", event.uid));
  lines.push(line("DTSTAMP", nowStamp()));
  lines.push(line("DTSTART", event.dtStartUtc));
  lines.push(line("DTEND", event.dtEndUtc));
  lines.push(line("SUMMARY", escapeText(event.summary)));
  if (event.location) {
    lines.push(line("LOCATION", escapeText(event.location)));
  }
  if (event.description) {
    lines.push(line("DESCRIPTION", escapeText(event.description)));
  }
  lines.push(line("STATUS", event.status));
  lines.push(line("SEQUENCE", String(event.sequence)));
  lines.push("TRANSP:TRANSPARENT");

  if (cfg.alarmMinutes > 0 && event.status !== "CANCELLED") {
    lines.push("BEGIN:VALARM");
    lines.push("ACTION:DISPLAY");
    lines.push(line("DESCRIPTION", escapeText(event.summary)));
    lines.push(`TRIGGER:-PT${cfg.alarmMinutes}M`);
    lines.push("END:VALARM");
  }

  lines.push("END:VEVENT");
  return lines.join(CRLF);
};

export const renderCalendar = (events: CalendarEvent[], cfg: CalendarConfig): string => {
  const header: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Minuto90Score//World Cup 2026//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    foldLine(`X-WR-CALNAME:${cfg.calendarName}`),
    "X-WR-TIMEZONE:UTC",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
  ];
  const body = events.map((event) => renderEvent(event, cfg));
  const all = [...header, ...body, "END:VCALENDAR"];
  // Incluye CRLF final tras END:VCALENDAR.
  return all.join(CRLF) + CRLF;
};
