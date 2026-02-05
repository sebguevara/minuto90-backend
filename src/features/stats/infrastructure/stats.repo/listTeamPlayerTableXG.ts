import { whoscoredPrismaClient } from "../../../../lib/whoscored-client";
import type { TeamPlayerTableQuery } from "../../dtos/stats.dto";

export async function listTeamPlayerTableXG(teamId: number, query: TeamPlayerTableQuery) {
  const db = whoscoredPrismaClient;
  const where = {
    teamId,
    ...(query.typeId && { typeId: query.typeId }),
    ...(query.categoryId && { categoryId: query.categoryId }),
    ...(query.sectionId && { sectionId: query.sectionId }),
  };

  const [items, total] = await Promise.all([
    db.playerTableXG.findMany({
      where,
      include: {
        Player: { include: { Country: true } },
        Team: { include: { Country: true } },
        TableType: true,
        TableCategory: true,
        TableSection: true,
      },
      take: query.limit,
      skip: query.offset,
      orderBy: { rank: "asc" },
    }),
    db.playerTableXG.count({ where }),
  ]);

  return { items, total };
}

