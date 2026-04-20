import { minutoPrismaClient } from "../lib/minuto-client";
import { logWarn } from "../shared/logging/logger";
import type {
  ApiFootballFixtureStatisticLine,
  ApiFootballFixturePlayerStatistic,
} from "../features/sports/domain/football.types";
import {
  createEmptyFixtureStatsPeriodStore,
  normalizeTeamStats,
  type FootballCumulativeSnapshotId,
  type FootballFixtureStatsPeriodStore,
  type PlayerStatSnapshotRow,
  type PlayersBySnapshot,
  type TeamStatSnapshot,
} from "./fixture-stats-periods.logic";

export type { PlayerStatSnapshotRow, PlayersBySnapshot } from "./fixture-stats-periods.logic";

const SNAPSHOT_IDS: FootballCumulativeSnapshotId[] = [
  "first-half-end",
  "full-time-end",
  "extra-first-half-end",
  "final",
];

export async function saveTeamSnapshots(
  fixtureId: number,
  snapshotId: FootballCumulativeSnapshotId,
  teams: TeamStatSnapshot[]
): Promise<void> {
  if (!teams.length) return;
  try {
    await minutoPrismaClient.$transaction(
      teams.map((team) =>
        minutoPrismaClient.fixtureStatsPeriod.upsert({
          where: {
            fixtureId_snapshotId_teamId: {
              fixtureId,
              snapshotId,
              teamId: team.teamId,
            },
          },
          create: {
            fixtureId,
            snapshotId,
            teamId: team.teamId,
            teamName: team.teamName,
            statistics: team.statistics as unknown as object,
          },
          update: {
            teamName: team.teamName,
            statistics: team.statistics as unknown as object,
          },
        })
      )
    );
  } catch (err: any) {
    logWarn("fixture-stats-periods.db.save_team_failed", {
      fixtureId,
      snapshotId,
      err: err?.message ?? String(err),
    });
  }
}

export async function savePlayerSnapshots(
  fixtureId: number,
  snapshotId: FootballCumulativeSnapshotId,
  players: PlayerStatSnapshotRow[]
): Promise<void> {
  if (!players.length) return;
  try {
    await minutoPrismaClient.$transaction(
      players.map((player) =>
        minutoPrismaClient.fixturePlayerStatsPeriod.upsert({
          where: {
            fixtureId_snapshotId_playerId: {
              fixtureId,
              snapshotId,
              playerId: player.playerId,
            },
          },
          create: {
            fixtureId,
            snapshotId,
            teamId: player.teamId,
            playerId: player.playerId,
            playerName: player.playerName,
            statistics: player.statistics as unknown as object,
          },
          update: {
            teamId: player.teamId,
            playerName: player.playerName,
            statistics: player.statistics as unknown as object,
          },
        })
      )
    );
  } catch (err: any) {
    logWarn("fixture-stats-periods.db.save_players_failed", {
      fixtureId,
      snapshotId,
      err: err?.message ?? String(err),
    });
  }
}

export async function loadStoreFromDb(
  fixtureId: number
): Promise<FootballFixtureStatsPeriodStore | null> {
  try {
    const rows = await minutoPrismaClient.fixtureStatsPeriod.findMany({
      where: { fixtureId },
      orderBy: [{ snapshotId: "asc" }, { teamId: "asc" }],
    });
    if (!rows.length) return null;

    const store = createEmptyFixtureStatsPeriodStore(fixtureId);
    const latestUpdates: Date[] = [];

    for (const snapshotId of SNAPSHOT_IDS) {
      const teamRows = rows.filter((row) => row.snapshotId === snapshotId);
      if (!teamRows.length) continue;
      const teams: TeamStatSnapshot[] = teamRows.map((row) => ({
        teamId: row.teamId,
        teamName: row.teamName,
        statistics: (row.statistics ?? []) as unknown as ApiFootballFixtureStatisticLine[],
      }));
      store.snapshots[snapshotId] = normalizeTeamStats(teams);
      for (const row of teamRows) latestUpdates.push(row.updatedAt);
    }

    if (latestUpdates.length) {
      const newest = latestUpdates.reduce((a, b) => (a > b ? a : b));
      store.updatedAt = newest.toISOString();
    }

    return store.snapshots["first-half-end"] ||
      store.snapshots["full-time-end"] ||
      store.snapshots["extra-first-half-end"] ||
      store.snapshots.final
      ? store
      : null;
  } catch (err: any) {
    logWarn("fixture-stats-periods.db.load_failed", {
      fixtureId,
      err: err?.message ?? String(err),
    });
    return null;
  }
}

export async function loadPlayerPeriods(fixtureId: number): Promise<PlayersBySnapshot> {
  try {
    const rows = await minutoPrismaClient.fixturePlayerStatsPeriod.findMany({
      where: { fixtureId },
    });
    const bucket: PlayersBySnapshot = {};
    for (const row of rows) {
      const snapshotId = row.snapshotId as FootballCumulativeSnapshotId;
      if (!SNAPSHOT_IDS.includes(snapshotId)) continue;
      const list = bucket[snapshotId] ?? [];
      list.push({
        teamId: row.teamId,
        playerId: row.playerId,
        playerName: row.playerName,
        statistics: (row.statistics ?? []) as unknown as ApiFootballFixturePlayerStatistic[],
      });
      bucket[snapshotId] = list;
    }
    return bucket;
  } catch (err: any) {
    logWarn("fixture-stats-periods.db.load_players_failed", {
      fixtureId,
      err: err?.message ?? String(err),
    });
    return {};
  }
}
