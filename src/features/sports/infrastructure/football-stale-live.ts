/**
 * Guard de "live rancio" (stale-live).
 *
 * API-Football a veces deja un fixture clavado en un estado en juego (p. ej. "1H", minuto 28)
 * y nunca lo avanza a FT: el partido real terminó hace horas pero el proveedor lo sigue
 * publicando como en vivo (incluso dentro de /fixtures?live=all). Como minuto90score refleja
 * al proveedor casi en tiempo real (cache de ~1s), esos fixtures quedan "En vivo" para siempre.
 *
 * Estas funciones puras detectan ese caso por antigüedad del kickoff y lo neutralizan:
 *  - coerceStaleLiveFixture: reclasifica el status a FT (el partido se muestra finalizado).
 *  - filterOutStaleLive: lo saca del set en vivo (snapshot, live=all, notificaciones, reloj).
 *
 * Sin side effects ni dependencias de infra para que rutas, poller y tests las consuman libres.
 */

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;

const DEFAULT_MAX_AGE_HOURS = 4;
const MIN_MAX_AGE_HOURS = 2;
const MAX_MAX_AGE_HOURS = 12;

/**
 * Estados "en juego" o de pausa breve que el proveedor puede dejar clavados y que sí
 * forzamos a FT por antigüedad. SUSP/INT (suspendido/interrumpido) se excluyen a propósito:
 * pueden reanudarse o el proveedor los marca explícitamente, así que no los tocamos.
 */
export const STALE_LIVE_GUARDED_STATUSES = new Set([
  "1H",
  "HT",
  "2H",
  "ET",
  "BT",
  "P",
  "LIVE",
]);

export function getStaleLiveMaxAgeMs(): number {
  const raw = Number(process.env.FOOTBALL_STALE_LIVE_MAX_HOURS);
  const hours = Number.isFinite(raw)
    ? Math.min(Math.max(raw, MIN_MAX_AGE_HOURS), MAX_MAX_AGE_HOURS)
    : DEFAULT_MAX_AGE_HOURS;
  return hours * HOUR_MS;
}

type StaleLiveFixtureShape = {
  fixture?: {
    date?: string | null;
    timestamp?: number | null;
    status?: {
      short?: string | null;
      long?: string | null;
      elapsed?: number | null;
    } | null;
  } | null;
};

function kickoffMs(fixture: StaleLiveFixtureShape): number | null {
  const ts = fixture?.fixture?.timestamp;
  if (typeof ts === "number" && Number.isFinite(ts) && ts > 0) {
    return ts * SECOND_MS;
  }
  const date = fixture?.fixture?.date;
  if (typeof date === "string") {
    const ms = Date.parse(date);
    if (Number.isFinite(ms)) return ms;
  }
  return null;
}

/**
 * True si el fixture está en un estado en juego "guardado" pero su kickoff ya es más viejo
 * que el máximo plausible (default 4h). Un partido real no puede seguir en juego tanto después
 * de arrancar: si el proveedor lo sigue marcando live, es un dato congelado.
 */
export function isStaleLiveFixture(
  fixture: StaleLiveFixtureShape,
  now: number = Date.now(),
  maxAgeMs: number = getStaleLiveMaxAgeMs()
): boolean {
  const short = fixture?.fixture?.status?.short ?? null;
  if (!short || !STALE_LIVE_GUARDED_STATUSES.has(short)) return false;
  const ko = kickoffMs(fixture);
  if (ko === null) return false;
  return now - ko > maxAgeMs;
}

/**
 * Si el fixture está "live rancio", devuelve una copia con el status forzado a FT y el minuto
 * en null (frena el reloj del cliente). Si no, devuelve el mismo objeto sin tocar.
 */
export function coerceStaleLiveFixture<T extends StaleLiveFixtureShape>(
  fixture: T,
  now: number = Date.now(),
  maxAgeMs: number = getStaleLiveMaxAgeMs()
): T {
  if (!isStaleLiveFixture(fixture, now, maxAgeMs)) return fixture;
  return {
    ...fixture,
    fixture: {
      ...fixture.fixture,
      status: {
        ...(fixture.fixture?.status ?? {}),
        short: "FT",
        long: "Match Finished",
        elapsed: null,
      },
    },
  } as T;
}

/** Saca del listado los fixtures "live rancios" (para el set en vivo del poller). */
export function filterOutStaleLive<T extends StaleLiveFixtureShape>(
  fixtures: T[],
  now: number = Date.now(),
  maxAgeMs: number = getStaleLiveMaxAgeMs()
): T[] {
  return fixtures.filter((f) => !isStaleLiveFixture(f, now, maxAgeMs));
}
