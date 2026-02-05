import { whoscoredPrismaClient } from "../../../../lib/whoscored-client";
import type { PaginationQuery } from "../../dtos/stats.dto";

export async function listTeamTournaments(
  teamId: number,
  pagination: PaginationQuery,
  seasonId?: number
) {
  const db = whoscoredPrismaClient;
  const where = { teamId, ...(seasonId && { seasonId }) };

  const [items, total] = await Promise.all([
    db.teamInTournament.findMany({
      where,
      include: {
        Tournament: { include: { Country: true, Region: true } },
        Season: true,
        Country: true,
        Team: { include: { Country: true } },
      },
      take: pagination.limit,
      skip: pagination.offset,
      orderBy: { id: "desc" },
    }),
    db.teamInTournament.count({ where }),
  ]);

  return { items, total };
}

