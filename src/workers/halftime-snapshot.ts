import { footballApiClient } from "../features/sports/infrastructure/football-api.client";
import type {
  ApiFootballFixturePlayersItem,
  ApiFootballFixtureStatisticsItem,
} from "../features/sports/domain/football.types";
import { redisConnection } from "../shared/redis/redis.connection";
import { logInfo, logWarn } from "../shared/logging/logger";
import {
  buildFixtureStatsPeriodsResponse,
  createEmptyFixtureStatsPeriodStore,
  getSnapshotIdsToCaptureForStatus,
  normalizeTeamStats,
  subtractTeamStats,
  type FootballFixtureStatsPeriodStore,
  type FootballStatsByPeriodResponse,
  type PlayerStatSnapshotRow,
  type TeamStatSnapshot,
} from "./fixture-stats-periods.logic";
import {
  loadPlayerPeriods,
  loadStoreFromDb,
  savePlayerSnapshots,
  saveTeamSnapshots,
} from "./fixture-stats-periods.repo";

export * from "./fixture-stats-periods.logic";
export { loadPlayerPeriods } from "./fixture-stats-periods.repo";

const SNAPSHOT_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days
const legacyHalftimeSnapshotKey = (fixtureId: number) => `ht_snapshot:${fixtureId}`;
const periodSnapshotKey = (fixtureId: number) => `football:fixture_stats_periods:${fixtureId}`;

export interface PlayerStatSnapshot {
  playerId: number;
  teamId: number;
  name: string;
  statistics: Record<string, unknown>;
}

export interface HalftimeSnapshot {
  fixtureId: number;
  capturedAt: string;
  teamStats: TeamStatSnapshot[];
  playerStats: PlayerStatSnapshot[];
}

function parseStore(raw: string, fixtureId: number): FootballFixtureStatsPeriodStore | null {
  try {
    const parsed = JSON.parse(raw) as FootballFixtureStatsPeriodStore;
    if (!parsed || parsed.fixtureId !== fixtureId || typeof parsed.snapshots !== "object") return null;
    return {
      version: 1,
      fixtureId,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      lastStatusShort: parsed.lastStatusShort ?? null,
      lastElapsed: parsed.lastElapsed ?? null,
      snapshots: {
        "first-half-end": parsed.snapshots["first-half-end"]
          ? normalizeTeamStats(parsed.snapshots["first-half-end"])
          : undefined,
        "full-time-end": parsed.snapshots["full-time-end"]
          ? normalizeTeamStats(parsed.snapshots["full-time-end"])
          : undefined,
        "extra-first-half-end": parsed.snapshots["extra-first-half-end"]
          ? normalizeTeamStats(parsed.snapshots["extra-first-half-end"])
          : undefined,
        final: parsed.snapshots.final ? normalizeTeamStats(parsed.snapshots.final) : undefined,
      },
    };
  } catch {
    return null;
  }
}

async function readLegacyHalftimeSnapshot(fixtureId: number): Promise<FootballFixtureStatsPeriodStore | null> {
  const raw = await redisConnection.get(legacyHalftimeSnapshotKey(fixtureId));
  if (!raw) return null;
  try {
    const legacy = JSON.parse(raw) as HalftimeSnapshot;
    if (!legacy?.teamStats?.length) return null;
    return {
      ...createEmptyFixtureStatsPeriodStore(fixtureId),
      updatedAt: legacy.capturedAt ?? new Date().toISOString(),
      lastStatusShort: "HT",
      snapshots: {
        "first-half-end": normalizeTeamStats(legacy.teamStats),
      },
    };
  } catch {
    return null;
  }
}

export async function getFixtureStatsPeriodsStore(
  fixtureId: number
): Promise<FootballFixtureStatsPeriodStore | null> {
  try {
    const raw = await redisConnection.get(periodSnapshotKey(fixtureId));
    if (raw) {
      const parsed = parseStore(raw, fixtureId);
      if (parsed) return parsed;
    }
    const legacy = await readLegacyHalftimeSnapshot(fixtureId);
    if (legacy) return legacy;
    const dbStore = await loadStoreFromDb(fixtureId);
    if (dbStore) {
      // Rehidratar Redis para mantener el hot path caliente en próximas lecturas.
      writeFixtureStatsPeriodsStore(dbStore).catch(() => {});
    }
    return dbStore;
  } catch (err: any) {
    logWarn("fixture-stats-periods.get_failed", {
      fixtureId,
      err: err?.message ?? String(err),
    });
    return null;
  }
}

async function writeFixtureStatsPeriodsStore(store: FootballFixtureStatsPeriodStore): Promise<void> {
  await redisConnection.set(
    periodSnapshotKey(store.fixtureId),
    JSON.stringify(store),
    "EX",
    SNAPSHOT_TTL_SECONDS
  );
}

async function fetchCurrentTeamStats(fixtureId: number): Promise<TeamStatSnapshot[]> {
  const statsRes = await footballApiClient.getFixtureStatistics({ fixture: fixtureId });
  return normalizeTeamStats(statsRes.response ?? []);
}

function normalizePlayersResponse(items: ApiFootballFixturePlayersItem[]): PlayerStatSnapshotRow[] {
  const rows: PlayerStatSnapshotRow[] = [];
  for (const item of items ?? []) {
    const teamId = item.team?.id;
    if (typeof teamId !== "number") continue;
    for (const playerEntry of item.players ?? []) {
      const playerId = playerEntry.player?.id;
      if (typeof playerId !== "number") continue;
      rows.push({
        teamId,
        playerId,
        playerName: playerEntry.player?.name ?? "",
        statistics: playerEntry.statistics ?? [],
      });
    }
  }
  return rows;
}

async function fetchCurrentPlayerStats(fixtureId: number): Promise<PlayerStatSnapshotRow[]> {
  try {
    const res = await footballApiClient.getFixturePlayers({ fixture: fixtureId });
    return normalizePlayersResponse(res.response ?? []);
  } catch (err: any) {
    logWarn("fixture-stats-periods.players_fetch_failed", {
      fixtureId,
      err: err?.message ?? String(err),
    });
    return [];
  }
}

export async function captureFixtureStatsPeriodSnapshot(input: {
  fixtureId: number;
  statusShort: string | null | undefined;
  elapsed?: number | null;
}): Promise<void> {
  const { fixtureId, statusShort, elapsed = null } = input;

  try {
    const existingStore =
      (await getFixtureStatsPeriodsStore(fixtureId)) ?? createEmptyFixtureStatsPeriodStore(fixtureId);
    const store: FootballFixtureStatsPeriodStore = {
      ...existingStore,
      updatedAt: new Date().toISOString(),
      lastStatusShort: statusShort ?? null,
      lastElapsed: elapsed ?? null,
      snapshots: { ...existingStore.snapshots },
    };

    const snapshotIds = getSnapshotIdsToCaptureForStatus(store, statusShort);
    if (!snapshotIds.length && !existingStore.snapshots["first-half-end"]) return;

    let capturedPlayers: PlayerStatSnapshotRow[] = [];
    if (snapshotIds.length) {
      const [currentStats, currentPlayers] = await Promise.all([
        fetchCurrentTeamStats(fixtureId),
        fetchCurrentPlayerStats(fixtureId),
      ]);
      if (!currentStats.length) return;
      capturedPlayers = currentPlayers;
      for (const snapshotId of snapshotIds) {
        store.snapshots[snapshotId] = currentStats;
      }
    }

    await writeFixtureStatsPeriodsStore(store);

    if (snapshotIds.length) {
      // Dual-write en Postgres. Fallos no bloquean (Redis es fuente de verdad en vivo).
      await Promise.all([
        ...snapshotIds.map((snapshotId) =>
          saveTeamSnapshots(fixtureId, snapshotId, store.snapshots[snapshotId] ?? [])
        ),
        ...(capturedPlayers.length
          ? snapshotIds.map((snapshotId) => savePlayerSnapshots(fixtureId, snapshotId, capturedPlayers))
          : []),
      ]);

      logInfo("fixture-stats-periods.snapshots_saved", {
        fixtureId,
        statusShort,
        elapsed,
        snapshots: snapshotIds,
        teams: snapshotIds.length ? store.snapshots[snapshotIds[0]]?.length ?? 0 : 0,
        players: capturedPlayers.length,
      });
    }
  } catch (err: any) {
    logWarn("fixture-stats-periods.capture_failed", {
      fixtureId,
      statusShort,
      err: err?.message ?? String(err),
    });
  }
}

export async function getFixtureStatsByPeriodResponse(
  fixtureId: number,
  currentStatsInput?: TeamStatSnapshot[] | ApiFootballFixtureStatisticsItem[]
): Promise<FootballStatsByPeriodResponse> {
  const [store, players] = await Promise.all([
    getFixtureStatsPeriodsStore(fixtureId),
    loadPlayerPeriods(fixtureId),
  ]);
  return buildFixtureStatsPeriodsResponse(store, currentStatsInput, players);
}

export async function saveHalftimeSnapshot(fixtureId: number): Promise<void> {
  await captureFixtureStatsPeriodSnapshot({
    fixtureId,
    statusShort: "HT",
    elapsed: 45,
  });
}

export async function getHalftimeSnapshot(fixtureId: number): Promise<HalftimeSnapshot | null> {
  const store = await getFixtureStatsPeriodsStore(fixtureId);
  const teamStats = store?.snapshots["first-half-end"];
  if (!teamStats) return null;
  return {
    fixtureId,
    capturedAt: store.updatedAt,
    teamStats,
    playerStats: [],
  };
}

export function computeSecondHalfTeamStats(
  htStats: TeamStatSnapshot[],
  ftStats: ApiFootballFixtureStatisticsItem[]
): TeamStatSnapshot[] {
  return subtractTeamStats(htStats, ftStats);
}
