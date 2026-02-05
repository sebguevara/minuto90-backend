import { whoscoredPrismaClient } from "../../../../lib/whoscored-client";
import type { TeamPerformanceQuery } from "../../dtos/stats.dto";

export async function listTeamPerformance(
  teamId: number,
  query: TeamPerformanceQuery
) {
  const db = whoscoredPrismaClient;
  const where = {
    teamId,
    tournamentId: query.tournamentId,
    viewTypeId: query.viewTypeId,
    ...(query.category && { category: query.category }),
    mode: query.mode,
  };

  const [items, total] = await Promise.all([
    db.teamPerformanceStat.findMany({
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
    db.teamPerformanceStat.count({ where }),
  ]);

  return { items, total };
}

