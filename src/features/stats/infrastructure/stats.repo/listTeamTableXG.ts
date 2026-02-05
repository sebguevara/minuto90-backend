import { whoscoredPrismaClient } from "../../../../lib/whoscored-client";
import type { TeamTableQuery } from "../../dtos/stats.dto";

export async function listTeamTableXG(teamId: number, query: TeamTableQuery) {
  const db = whoscoredPrismaClient;
  const where = {
    teamId,
    tournamentId: query.tournamentId,
    ...(query.typeId && { typeId: query.typeId }),
    ...(query.categoryId && { categoryId: query.categoryId }),
    ...(query.sectionId && { sectionId: query.sectionId }),
  };

  const [items, total] = await Promise.all([
    db.tableXG.findMany({
      where,
      include: {
        Team: { include: { Country: true } },
        Tournament: { include: { Country: true, Region: true } },
        TableType: true,
        TableCategory: true,
        TableSection: true,
      },
      take: query.limit,
      skip: query.offset,
      orderBy: { rank: "asc" },
    }),
    db.tableXG.count({ where }),
  ]);

  return { items, total };
}

