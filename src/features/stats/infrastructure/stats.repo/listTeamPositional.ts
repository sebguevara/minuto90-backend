import { whoscoredPrismaClient } from "../../../../lib/whoscored-client";
import type { TeamPositionalQuery } from "../../dtos/stats.dto";

export async function listTeamPositional(
  teamId: number,
  query: TeamPositionalQuery
) {
  const db = whoscoredPrismaClient;
  const where = {
    teamId,
    tournamentId: query.tournamentId,
    viewTypeId: query.viewTypeId,
    ...(query.sectionId && { sectionId: query.sectionId }),
  };

  const [items, total] = await Promise.all([
    db.teamPositionalStat.findMany({
      where,
      include: {
        Team: { include: { Country: true } },
        Tournament: { include: { Country: true, Region: true } },
        TableType: true,
        TableSection: true,
      },
      take: query.limit,
      skip: query.offset,
    }),
    db.teamPositionalStat.count({ where }),
  ]);

  return { items, total };
}

