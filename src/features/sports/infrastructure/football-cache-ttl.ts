const SECOND = 1;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

function readEnvSeconds(name: string, fallback: number, minSeconds: number, maxSeconds: number) {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw)) {
    return fallback;
  }

  return Math.min(Math.max(Math.floor(raw), minSeconds), maxSeconds);
}

function toUtcDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalizeDateKey(date: string) {
  const trimmed = date.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return trimmed;
  }
  return toUtcDateKey(parsed);
}

export function compareFootballDateToToday(date: string, now = new Date()) {
  const normalizedDate = normalizeDateKey(date);
  const today = toUtcDateKey(now);
  return normalizedDate.localeCompare(today);
}

export function getFootballOddsTodayCacheTtlSeconds() {
  return readEnvSeconds("FOOTBALL_ODDS_TTL_TODAY_SECONDS", 3 * HOUR, 5 * MINUTE, 24 * HOUR);
}

export function getFootballOddsFutureCacheTtlSeconds() {
  return readEnvSeconds("FOOTBALL_ODDS_TTL_FUTURE_SECONDS", 6 * HOUR, 5 * MINUTE, 48 * HOUR);
}

export function getFootballOddsPastCacheTtlSeconds() {
  return readEnvSeconds("FOOTBALL_ODDS_TTL_PAST_SECONDS", 24 * HOUR, 5 * MINUTE, 7 * 24 * HOUR);
}

export function getFootballOddsLiveCacheTtlSeconds() {
  return readEnvSeconds("FOOTBALL_ODDS_TTL_LIVE_SECONDS", 30, 5, 5 * MINUTE);
}

export function getFootballOddsSnapshotFreshTtlSeconds(date: string, now = new Date()) {
  const relation = compareFootballDateToToday(date, now);
  if (relation === 0) {
    return getFootballOddsTodayCacheTtlSeconds();
  }
  if (relation > 0) {
    return getFootballOddsFutureCacheTtlSeconds();
  }
  return getFootballOddsPastCacheTtlSeconds();
}

export function getFootballOddsSnapshotStaleGraceSeconds() {
  return readEnvSeconds("FOOTBALL_ODDS_STALE_GRACE_SECONDS", 24 * HOUR, 5 * MINUTE, 7 * 24 * HOUR);
}

export function getFootballOddsSnapshotRedisTtlSeconds(date: string, now = new Date()) {
  return (
    getFootballOddsSnapshotFreshTtlSeconds(date, now) +
    getFootballOddsSnapshotStaleGraceSeconds()
  );
}

export function getFootballOddsDatePageConcurrency() {
  return readEnvSeconds("FOOTBALL_ODDS_DATE_PAGE_CONCURRENCY", 6, 1, 12);
}

export function getFootballOddsDateRefreshLockTtlSeconds() {
  return readEnvSeconds("FOOTBALL_ODDS_DATE_LOCK_TTL_SECONDS", 10 * MINUTE, 30, 60 * MINUTE);
}

export function getFootballOddsTodayRefreshCron() {
  return process.env.FOOTBALL_ODDS_TODAY_CRON?.trim() || "0 */3 * * *";
}

const TTL_BY_ENDPOINT: Record<string, number> = {
  "/countries": 60 * 60 * 24,
  "/leagues": 60 * 60 * 12,
  "/leagues/seasons": 60 * 60 * 24,
  "/fixtures": 60,
  "/fixtures/rounds": 60 * 60 * 24,
  "/fixtures/headtohead": 60 * 15,
  "/fixtures/statistics": 60,
  "/fixtures/events": 60,
  "/fixtures/lineups": 60,
  "/fixtures/players": 60,
  "/teams/statistics": 60,
  "/timezone": 60 * 60 * 24,
  "/teams": 60 * 30,
  "/teams/seasons": 60 * 60 * 24,
  "/teams/countries": 60 * 60 * 24,
  "/venues": 60 * 60 * 24,
  "/standings": 60 * 15,
  "/injuries": 60 * 5,
  "/predictions": 60 * 10,
  "/coachs": 60 * 30,
  "/players/seasons": 60 * 60 * 24,
  "/players/profiles": 60 * 60,
  "/players": 60 * 30,
  "/players/squads": 60 * 60,
  "/players/teams": 60 * 60 * 12,
  "/players/topscorers": 60 * 30,
  "/players/topassists": 60 * 30,
  "/players/topyellowcards": 60 * 30,
  "/players/topredcards": 60 * 30,
  "/transfers": 60 * 60 * 6,
  "/trophies": 60 * 60 * 24,
  "/sidelined": 60 * 60 * 6,
  "/odds/live": getFootballOddsLiveCacheTtlSeconds(),
  "/odds/live/bets": 60 * 60 * 24,
  "/odds": 60,
  "/odds/mapping": 60 * 30,
  "/odds/bookmakers": 60 * 60 * 24,
  "/odds/bets": 60 * 60 * 24,
};

export function getFootballCacheTtlSeconds(endpoint: string, params?: Record<string, unknown>) {
  if (endpoint === "/fixtures") {
    if (params?.live || params?.id || params?.ids) {
      return 5;
    }

    if (params?.date) {
      return 20;
    }
  }

  return TTL_BY_ENDPOINT[endpoint] ?? 0;
}
