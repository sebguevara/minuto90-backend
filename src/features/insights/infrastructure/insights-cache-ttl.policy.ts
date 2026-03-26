const LIVE_STATUS = new Set([
  "1H",
  "2H",
  "ET",
  "P",
  "BT",
  "LIVE",
  "INT",
  "HT",
  "SUSP",
  "INTR",
]);

const FINISHED_STATUS = new Set(["FT", "AET", "PEN"]);

type MatchState = "live" | "upcoming_near" | "upcoming_far" | "finished_recent" | "finished_old";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

function normalizeDate(input: string | number | Date | null | undefined): Date | null {
  if (!input) return null;
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function resolveMatchState(input: {
  statusShort?: string | null;
  kickoffAt?: string | number | Date | null;
  now?: Date;
}): MatchState {
  const status = (input.statusShort ?? "").toUpperCase();
  const now = input.now ?? new Date();
  const kickoffAt = normalizeDate(input.kickoffAt);

  if (LIVE_STATUS.has(status)) {
    return "live";
  }

  if (FINISHED_STATUS.has(status)) {
    if (!kickoffAt) return "finished_old";
    return now.getTime() - kickoffAt.getTime() < ONE_DAY_MS
      ? "finished_recent"
      : "finished_old";
  }

  if (!kickoffAt) return "upcoming_far";
  return kickoffAt.getTime() - now.getTime() <= THREE_HOURS_MS
    ? "upcoming_near"
    : "upcoming_far";
}

export function getMatchStreaksTtlSeconds(state: MatchState) {
  switch (state) {
    case "live":
      return 60;
    case "upcoming_near":
      return 60 * 5;
    case "upcoming_far":
      return 60 * 30;
    case "finished_recent":
      return 60 * 60 * 6;
    case "finished_old":
      return 60 * 60 * 72;
    default:
      return 60 * 10;
  }
}

export function getMatchSummaryTtlSeconds(state: MatchState) {
  switch (state) {
    case "live":
      return 60 * 3; // 3 minutes
    case "upcoming_near":
      return 60 * 60 * 6; // 6 hours — pre-match analysis persists until kickoff
    case "upcoming_far":
      return 60 * 60 * 24; // 24 hours — regenerates once per day
    case "finished_recent":
      return 60 * 60 * 24 * 30;
    case "finished_old":
      return 60 * 60 * 24 * 30;
    default:
      return 60 * 10;
  }
}

export function getDailyInsightsTtlSeconds(date: string, now: Date = new Date()) {
  const today = now.toISOString().slice(0, 10);
  return date === today ? 60 * 30 : 60 * 60 * 24 * 7;
}

export function getFeaturedMatchesTtlSeconds(date: string, now: Date = new Date()) {
  const today = now.toISOString().slice(0, 10);
  // Today: refresh every 30 min (odds/lineups change). Past: cache 7 days.
  return date === today ? 60 * 30 : 60 * 60 * 24 * 7;
}

