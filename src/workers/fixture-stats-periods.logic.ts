import type {
  ApiFootballFixturePlayerStatistic,
  ApiFootballFixtureStatisticLine,
  ApiFootballFixtureStatisticsItem,
} from "../features/sports/domain/football.types";

const BALL_POSSESSION = "Ball Possession";
const PASSES_PERCENT = "Passes %";
const PASSES_ACCURATE = "Passes accurate";
const TOTAL_PASSES = "Total passes";

export type FootballStatsPeriodId =
  | "first-half"
  | "second-half"
  | "extra-first-half"
  | "extra-second-half";

export type FootballStatsPeriodStatus = "complete" | "partial";

export type FootballCumulativeSnapshotId =
  | "first-half-end"
  | "full-time-end"
  | "extra-first-half-end"
  | "final";

export interface TeamStatSnapshot {
  teamId: number;
  teamName: string;
  statistics: ApiFootballFixtureStatisticLine[];
}

export interface PlayerStatSnapshotRow {
  teamId: number;
  playerId: number;
  playerName: string;
  statistics: ApiFootballFixturePlayerStatistic[];
}

export type PlayersBySnapshot = Partial<Record<FootballCumulativeSnapshotId, PlayerStatSnapshotRow[]>>;

export interface PlayerStatsPeriodTeam {
  teamId: number;
  players: PlayerStatSnapshotRow[];
}

export type PlayersByPeriod = Partial<Record<FootballStatsPeriodId, PlayerStatsPeriodTeam[]>>;

export interface FootballFixtureStatsPeriodStore {
  version: 1;
  fixtureId: number;
  updatedAt: string;
  lastStatusShort: string | null;
  lastElapsed: number | null;
  snapshots: Partial<Record<FootballCumulativeSnapshotId, TeamStatSnapshot[]>>;
}

export interface FootballStatsPeriod {
  id: FootballStatsPeriodId;
  label: string;
  status: FootballStatsPeriodStatus;
  teams: TeamStatSnapshot[];
}

export interface FootballStatsByPeriodResponse {
  hasSnapshot: boolean;
  periods: FootballStatsPeriod[];
  firstHalf?: TeamStatSnapshot[];
  secondHalf?: TeamStatSnapshot[];
  playersByPeriod?: PlayersByPeriod;
}

type TeamStatsInput = TeamStatSnapshot[] | ApiFootballFixtureStatisticsItem[];

const PERIOD_LABELS: Record<FootballStatsPeriodId, string> = {
  "first-half": "1er Tiempo",
  "second-half": "2do Tiempo",
  "extra-first-half": "1er Tiempo Extra",
  "extra-second-half": "2do Tiempo Extra",
};

export function createEmptyFixtureStatsPeriodStore(fixtureId: number): FootballFixtureStatsPeriodStore {
  return {
    version: 1,
    fixtureId,
    updatedAt: new Date().toISOString(),
    lastStatusShort: null,
    lastElapsed: null,
    snapshots: {},
  };
}

function isApiFootballStatsItem(
  item: TeamStatSnapshot | ApiFootballFixtureStatisticsItem
): item is ApiFootballFixtureStatisticsItem {
  return "team" in item;
}

export function normalizeTeamStats(input: TeamStatsInput): TeamStatSnapshot[] {
  return (input ?? []).map((item) => {
    if (isApiFootballStatsItem(item)) {
      return {
        teamId: item.team.id,
        teamName: item.team.name,
        statistics: (item.statistics ?? []).map((stat) => ({
          type: stat.type,
          value: stat.value,
        })),
      };
    }

    return {
      teamId: item.teamId,
      teamName: item.teamName,
      statistics: (item.statistics ?? []).map((stat) => ({
        type: stat.type,
        value: stat.value,
      })),
    };
  });
}

function parseStatValue(value: string | number | boolean | null | undefined): number | null {
  if (value === null || value === undefined || typeof value === "boolean") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace("%", "").trim();
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundStatValue(value: number): number {
  const rounded = Math.round(Math.max(0, value) * 100) / 100;
  return Number.isInteger(rounded) ? Math.trunc(rounded) : rounded;
}

function valueByType(stats: ApiFootballFixtureStatisticLine[], type: string): number | null {
  return parseStatValue(stats.find((stat) => stat.type === type)?.value);
}

function computePassesPercent(stats: ApiFootballFixtureStatisticLine[]): number | null {
  const accurate = valueByType(stats, PASSES_ACCURATE);
  const total = valueByType(stats, TOTAL_PASSES);
  if (accurate === null || total === null || total <= 0) return null;
  return Math.round((accurate / total) * 100);
}

export function subtractTeamStats(
  startStatsInput: TeamStatsInput,
  endStatsInput: TeamStatsInput
): TeamStatSnapshot[] {
  const startStats = normalizeTeamStats(startStatsInput);
  const endStats = normalizeTeamStats(endStatsInput);
  const startByTeam = new Map(
    startStats.map((team) => [
      team.teamId,
      new Map(team.statistics.map((stat) => [stat.type, stat.value])),
    ])
  );

  return endStats.map((endTeam) => {
    const startTeamStats = startByTeam.get(endTeam.teamId);
    const derivedStats: ApiFootballFixtureStatisticLine[] = endTeam.statistics.map((endStat) => {
      if (endStat.type === BALL_POSSESSION || endStat.type === PASSES_PERCENT) {
        return { type: endStat.type, value: null };
      }

      const endValue = parseStatValue(endStat.value);
      const startValue = parseStatValue(startTeamStats?.get(endStat.type));
      if (endValue === null || startValue === null) {
        return { type: endStat.type, value: null };
      }

      return { type: endStat.type, value: roundStatValue(endValue - startValue) };
    });

    const passesPercent = computePassesPercent(derivedStats);
    if (passesPercent !== null) {
      const passesStat = derivedStats.find((stat) => stat.type === PASSES_PERCENT);
      if (passesStat) passesStat.value = passesPercent;
    }

    return {
      teamId: endTeam.teamId,
      teamName: endTeam.teamName,
      statistics: derivedStats,
    };
  });
}

function makePeriod(
  id: FootballStatsPeriodId,
  status: FootballStatsPeriodStatus,
  teams: TeamStatSnapshot[]
): FootballStatsPeriod {
  return {
    id,
    label: PERIOD_LABELS[id],
    status,
    teams: normalizeTeamStats(teams),
  };
}

function isFullTimeOrLater(status: string | null | undefined): boolean {
  return status === "FT" || status === "ET" || status === "BT" || status === "P" || status === "AET" || status === "PEN";
}

function isExtraFirstHalfLive(status: string | null | undefined, elapsed: number | null | undefined): boolean {
  return status === "ET" && (typeof elapsed !== "number" || elapsed <= 105);
}

function isExtraSecondHalfLive(status: string | null | undefined, elapsed: number | null | undefined): boolean {
  return status === "ET" && typeof elapsed === "number" && elapsed > 105;
}

function isExtraTimeComplete(status: string | null | undefined): boolean {
  return status === "P" || status === "AET" || status === "PEN";
}

function groupPlayersByTeam(players: PlayerStatSnapshotRow[]): PlayerStatsPeriodTeam[] {
  const byTeam = new Map<number, PlayerStatSnapshotRow[]>();
  for (const player of players) {
    const bucket = byTeam.get(player.teamId) ?? [];
    bucket.push(player);
    byTeam.set(player.teamId, bucket);
  }
  return Array.from(byTeam.entries()).map(([teamId, list]) => ({ teamId, players: list }));
}

function buildPlayersByPeriod(
  players: PlayersBySnapshot | undefined,
  includedPeriodIds: FootballStatsPeriodId[]
): PlayersByPeriod | undefined {
  if (!players) return undefined;
  const out: PlayersByPeriod = {};
  // Mapeo directo snapshot → período (los snapshots acumulados `full-time-end` / `final` no se
  // restan para jugadores: se exponen tal cual por período usando el snapshot correspondiente).
  const map: Partial<Record<FootballStatsPeriodId, FootballCumulativeSnapshotId>> = {
    "first-half": "first-half-end",
    "second-half": "full-time-end",
    "extra-first-half": "extra-first-half-end",
    "extra-second-half": "final",
  };
  for (const periodId of includedPeriodIds) {
    const snapshotId = map[periodId];
    if (!snapshotId) continue;
    const rows = players[snapshotId];
    if (!rows?.length) continue;
    out[periodId] = groupPlayersByTeam(rows);
  }
  return Object.keys(out).length ? out : undefined;
}

export function buildFixtureStatsPeriodsResponse(
  store: FootballFixtureStatsPeriodStore | null,
  currentStatsInput?: TeamStatsInput,
  players?: PlayersBySnapshot
): FootballStatsByPeriodResponse {
  if (!store) return { hasSnapshot: false, periods: [] };

  const currentStats = currentStatsInput ? normalizeTeamStats(currentStatsInput) : null;
  const { snapshots } = store;
  const periods: FootballStatsPeriod[] = [];
  const firstHalfEnd = snapshots["first-half-end"] ?? null;
  const fullTimeEnd =
    snapshots["full-time-end"] ??
    (firstHalfEnd && currentStats && isFullTimeOrLater(store.lastStatusShort) ? currentStats : null);
  const extraFirstHalfEnd =
    snapshots["extra-first-half-end"] ??
    (fullTimeEnd && currentStats && isExtraFirstHalfLive(store.lastStatusShort, store.lastElapsed)
      ? currentStats
      : null);
  const finalEnd =
    snapshots.final ??
    (extraFirstHalfEnd &&
    currentStats &&
    (isExtraSecondHalfLive(store.lastStatusShort, store.lastElapsed) || isExtraTimeComplete(store.lastStatusShort))
      ? currentStats
      : null);

  if (firstHalfEnd) {
    periods.push(makePeriod("first-half", "complete", firstHalfEnd));
  }

  if (firstHalfEnd) {
    const secondEnd =
      fullTimeEnd ??
      (currentStats && store.lastStatusShort === "2H" ? currentStats : null);
    if (secondEnd) {
      periods.push(
        makePeriod(
          "second-half",
          snapshots["full-time-end"] || isFullTimeOrLater(store.lastStatusShort) ? "complete" : "partial",
          subtractTeamStats(firstHalfEnd, secondEnd)
        )
      );
    }
  }

  if (fullTimeEnd && extraFirstHalfEnd) {
    periods.push(
      makePeriod(
        "extra-first-half",
        snapshots["extra-first-half-end"] ? "complete" : "partial",
        subtractTeamStats(fullTimeEnd, extraFirstHalfEnd)
      )
    );
  }

  if (extraFirstHalfEnd && finalEnd) {
    periods.push(
      makePeriod(
        "extra-second-half",
        snapshots.final || isExtraTimeComplete(store.lastStatusShort) ? "complete" : "partial",
        subtractTeamStats(extraFirstHalfEnd, finalEnd)
      )
    );
  }

  const firstHalf = periods.find((period) => period.id === "first-half")?.teams;
  const secondHalf = periods.find((period) => period.id === "second-half")?.teams;
  const playersByPeriod = buildPlayersByPeriod(
    players,
    periods.map((period) => period.id)
  );

  return {
    hasSnapshot: periods.length > 0,
    periods,
    ...(firstHalf ? { firstHalf } : {}),
    ...(secondHalf ? { secondHalf } : {}),
    ...(playersByPeriod ? { playersByPeriod } : {}),
  };
}

export function getSnapshotIdsToCaptureForStatus(
  store: FootballFixtureStatsPeriodStore,
  statusShort: string | null | undefined
): FootballCumulativeSnapshotId[] {
  const ids: FootballCumulativeSnapshotId[] = [];
  const pushMissing = (id: FootballCumulativeSnapshotId) => {
    if (!store.snapshots[id]) ids.push(id);
  };

  switch (statusShort) {
    case "HT":
      pushMissing("first-half-end");
      break;
    case "FT":
      pushMissing("full-time-end");
      break;
    case "ET":
      pushMissing("full-time-end");
      break;
    case "BT":
      pushMissing("extra-first-half-end");
      break;
    case "P":
      pushMissing("full-time-end");
      if (store.snapshots["extra-first-half-end"]) pushMissing("final");
      break;
    case "AET":
    case "PEN":
      pushMissing("full-time-end");
      pushMissing("final");
      break;
    default:
      break;
  }

  return ids;
}
