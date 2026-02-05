import { whoscoredPrismaClient } from "../../../../lib/whoscored-client";
import type { TeamPlayerTableQuery } from "../../dtos/stats.dto";

export async function listTeamPlayerTableOffensive(
  teamId: number,
  query: TeamPlayerTableQuery
) {
  const db = whoscoredPrismaClient;
  const where = {
    teamId,
    ...(query.typeId && { typeId: query.typeId }),
    ...(query.categoryId && { categoryId: query.categoryId }),
  };

  const [items, total] = await Promise.all([
    db.playerTableOffensive.findMany({
      where,
      include: {
        Player: { include: { Country: true } },
        Team: { include: { Country: true } },
        TableType: true,
        TableCategory: true,
      },
      take: query.limit,
      skip: query.offset,
      orderBy: { rank: "asc" },
    }),
    db.playerTableOffensive.count({ where }),
  ]);

  return { items, total };
}

