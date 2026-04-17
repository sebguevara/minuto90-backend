import { footballApiClient } from "../features/sports/infrastructure/football-api.client";
import type {
  ApiFootballFixtureStatisticsItem,
  ApiFootballFixtureStatisticLine,
  ApiFootballFixturePlayersItem,
} from "../features/sports/domain/football.types";
import { redisConnection } from "../shared/redis/redis.connection";
import { logInfo, logWarn } from "../shared/logging/logger";

const SNAPSHOT_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days
const snapshotKey = (fixtureId: number) => `ht_snapshot:${fixtureId}`;

// Stats that are percentages or derived — cannot be subtracted
const PERCENTAGE_STATS = new Set([
  "Ball Possession",
  "Passes %",
]);

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface TeamStatSnapshot {
  teamId: number;
  teamName: string;
  statistics: ApiFootballFixtureStatisticLine[];
}

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

/* ------------------------------------------------------------------ */
/*  Save snapshot at halftime                                         */
/* ------------------------------------------------------------------ */

export async function saveHalftimeSnapshot(fixtureId: number): Promise<void> {
  try {
    const [statsRes, playersRes] = await Promise.all([
      footballApiClient.getFixtureStatistics({ fixture: fixtureId }),
      footballApiClient.getFixturePlayers({ fixture: fixtureId }),
    ]);

    const teamStats: TeamStatSnapshot[] = (statsRes.response ?? []).map(
      (item: ApiFootballFixtureStatisticsItem) => ({
        teamId: item.team.id,
        teamName: item.team.name,
        statistics: item.statistics,
      })
    );

    const playerStats: PlayerStatSnapshot[] = (playersRes.response ?? []).flatMap(
      (team: ApiFootballFixturePlayersItem) =>
        team.players.map((p) => ({
          playerId: p.player.id,
          teamId: team.team.id,
          name: p.player.name,
          statistics: p.statistics[0] as unknown as Record<string, unknown>,
        }))
    );

    const snapshot: HalftimeSnapshot = {
      fixtureId,
      capturedAt: new Date().toISOString(),
      teamStats,
      playerStats,
    };

    await redisConnection.set(
      snapshotKey(fixtureId),
      JSON.stringify(snapshot),
      "EX",
      SNAPSHOT_TTL_SECONDS
    );

    logInfo("halftime-snapshot.saved", {
      fixtureId,
      teams: teamStats.length,
      players: playerStats.length,
    });
  } catch (err: any) {
    logWarn("halftime-snapshot.save_failed", {
      fixtureId,
      err: err?.message ?? String(err),
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Read snapshot                                                     */
/* ------------------------------------------------------------------ */

export async function getHalftimeSnapshot(fixtureId: number): Promise<HalftimeSnapshot | null> {
  try {
    const raw = await redisConnection.get(snapshotKey(fixtureId));
    if (!raw) return null;
    return JSON.parse(raw) as HalftimeSnapshot;
  } catch (err: any) {
    logWarn("halftime-snapshot.get_failed", {
      fixtureId,
      err: err?.message ?? String(err),
    });
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Compute second-half stats by subtracting HT from FT              */
/* ------------------------------------------------------------------ */

function parseStatValue(value: string | number | boolean | null): number | null {
  if (value === null || value === undefined || typeof value === "boolean") return null;
  if (typeof value === "number") return value;
  const cleaned = String(value).replace("%", "").trim();
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function computeSecondHalfTeamStats(
  htStats: TeamStatSnapshot[],
  ftStats: ApiFootballFixtureStatisticsItem[]
): TeamStatSnapshot[] {
  return ftStats.map((ftTeam) => {
    const htTeam = htStats.find((ht) => ht.teamId === ftTeam.team.id);
    if (!htTeam) {
      return {
        teamId: ftTeam.team.id,
        teamName: ftTeam.team.name,
        statistics: ftTeam.statistics,
      };
    }

    const htMap = new Map(htTeam.statistics.map((s) => [s.type, s.value]));

    const secondHalfStats: ApiFootballFixtureStatisticLine[] = ftTeam.statistics.map((ftStat) => {
      if (PERCENTAGE_STATS.has(ftStat.type)) {
        return { type: ftStat.type, value: null };
      }

      const ftVal = parseStatValue(ftStat.value);
      const htVal = parseStatValue(htMap.get(ftStat.type) ?? null);

      if (ftVal === null || htVal === null) {
        return { type: ftStat.type, value: ftStat.value };
      }

      return { type: ftStat.type, value: Math.max(0, ftVal - htVal) };
    });

    return {
      teamId: ftTeam.team.id,
      teamName: ftTeam.team.name,
      statistics: secondHalfStats,
    };
  });
}
