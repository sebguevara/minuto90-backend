import { whoscoredPrismaClient } from "../../../../lib/whoscored-client";

export async function listTeamTables(
  teamId: number,
  tournamentId: number,
  viewTypeId: number
) {
  const db = whoscoredPrismaClient;
  const where = { teamId, tournamentId };

  const includeConfig = {
    Team: { include: { Country: true } },
    Tournament: { include: { Country: true, Region: true } },
    TableType: true,
    TableCategory: true,
    TableSection: true,
  };

  const [defensive, offensive, summary, xg] = await Promise.all([
    db.tableDefensive.findMany({ where, include: includeConfig, orderBy: { rank: "asc" } }),
    db.tableOffensive.findMany({ where, include: includeConfig, orderBy: { rank: "asc" } }),
    db.tableSummary.findMany({ where, include: includeConfig, orderBy: { rank: "asc" } }),
    db.tableXG.findMany({ where, include: includeConfig, orderBy: { rank: "asc" } }),
  ]);

  return { defensive, offensive, summary, xg };
}

