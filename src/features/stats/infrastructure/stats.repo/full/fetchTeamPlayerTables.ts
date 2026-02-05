import { whoscoredPrismaClient } from "../../../../../lib/whoscored-client";

export async function fetchTeamPlayerTables(teamId: number) {
  const db = whoscoredPrismaClient;
  const include = {
    Player: { include: { Country: true } },
    TableType: true,
    TableCategory: true,
  };
  const orderBy = { rank: "asc" as const };

  const [defensive, offensive, passing, summary, xg] = await Promise.all([
    db.playerTableDefensive.findMany({ where: { teamId }, include, orderBy }),
    db.playerTableOffensive.findMany({ where: { teamId }, include, orderBy }),
    db.playerTablePassing.findMany({ where: { teamId }, include, orderBy }),
    db.playerTableSummary.findMany({ where: { teamId }, include, orderBy }),
    db.playerTableXG.findMany({
      where: { teamId },
      include: { ...include, TableSection: true },
      orderBy,
    }),
  ]);

  return { defensive, offensive, passing, summary, xg };
}

