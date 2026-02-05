import { whoscoredPrismaClient } from "../../../../lib/whoscored-client";
import type { PaginationQuery } from "../../dtos/stats.dto";

export async function listTournamentTeams(
  tournamentId: number,
  pagination: PaginationQuery,
  seasonId?: number
) {
  const db = whoscoredPrismaClient;
  const where = { tournamentId, ...(seasonId && { seasonId }) };

  const [items, total] = await Promise.all([
    db.teamInTournament.findMany({
      where,
      include: {
        Team: { include: { Country: true } },
        Country: true,
        Season: true,
        Tournament: { include: { Country: true, Region: true } },
      },
      take: pagination.limit,
      skip: pagination.offset,
      orderBy: { id: "desc" },
    }),
    db.teamInTournament.count({ where }),
  ]);

  return { items, total };
}

