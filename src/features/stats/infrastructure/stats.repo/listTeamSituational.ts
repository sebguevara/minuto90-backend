import { whoscoredPrismaClient } from "../../../../lib/whoscored-client";
import type { TeamSituationalQuery } from "../../dtos/stats.dto";

export async function listTeamSituational(
  teamId: number,
  query: TeamSituationalQuery
) {
  const db = whoscoredPrismaClient;
  const where = {
    teamId,
    tournamentId: query.tournamentId,
    viewTypeId: query.viewTypeId,
    ...(query.sectionId && { sectionId: query.sectionId }),
  };

  const [items, total] = await Promise.all([
    db.teamSituationalStat.findMany({
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
    db.teamSituationalStat.count({ where }),
  ]);

  return { items, total };
}

