export type CalendarEventStatus = "CONFIRMED" | "TENTATIVE" | "CANCELLED";

/**
 * View model de un partido listo para renderizar como VEVENT.
 * Las fechas ya vienen formateadas en UTC básico (`YYYYMMDDTHHMMSSZ`).
 */
export interface CalendarEvent {
  /** UID estable por fixture → el cliente actualiza el evento en vez de duplicarlo. */
  uid: string;
  /** Inicio en UTC, formato iCalendar `YYYYMMDDTHHMMSSZ`. */
  dtStartUtc: string;
  /** Fin en UTC (inicio + duración configurada), mismo formato. */
  dtEndUtc: string;
  /** Título: "Local vs Visitante" (o los placeholders del cruce de API-Football). */
  summary: string;
  /** Sede + ciudad, o null si no hay datos. */
  location: string | null;
  /** Texto descriptivo (ronda, y marcador si el partido terminó). */
  description: string;
  /** Debe incrementar cuando cambian hora/equipos/estado para forzar update en clientes estrictos. */
  sequence: number;
  status: CalendarEventStatus;
}
