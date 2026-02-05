import { whoscoredPrismaClient } from "../../../../../lib/whoscored-client";

export async function fetchTeamTables(teamId: number) {
  const db = whoscoredPrismaClient;
  const include = {
    Tournament: { include: { Country: true, Region: true } },
    TableType: true,
    TableCategory: true,
    TableSection: true,
  };
  const orderBy = { rank: "asc" as const };

  const [defensive, offensive, summary, xg] = await Promise.all([
    db.tableDefensive.findMany({ where: { teamId }, include, orderBy }),
    db.tableOffensive.findMany({ where: { teamId }, include, orderBy }),
    db.tableSummary.findMany({ where: { teamId }, include, orderBy }),
    db.tableXG.findMany({ where: { teamId }, include, orderBy }),
  ]);

  return { defensive, offensive, summary, xg };
}

