import { whoscoredPrismaClient } from "../../../../lib/whoscored-client";
import type { TeamStreaksQuery } from "../../dtos/stats.dto";

export async function listTeamStreaks(teamId: number, query: TeamStreaksQuery) {
  const db = whoscoredPrismaClient;
  const where = {
    teamId,
    tournamentId: query.tournamentId,
    viewTypeId: query.viewTypeId,
    mode: query.mode,
    scope: query.scope,
  };

  const [items, total] = await Promise.all([
    db.teamStreakStat.findMany({
      where,
      include: {
        Team: { include: { Country: true } },
        Tournament: { include: { Country: true, Region: true } },
        TableType: true,
      },
      take: query.limit,
      skip: query.offset,
      orderBy: { rank: "asc" },
    }),
    db.teamStreakStat.count({ where }),
  ]);

  return { items, total };
}

