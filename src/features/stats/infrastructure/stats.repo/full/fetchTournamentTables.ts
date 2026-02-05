import { whoscoredPrismaClient } from "../../../../../lib/whoscored-client";

export async function fetchTournamentTables(tournamentId: number) {
  const db = whoscoredPrismaClient;
  const baseInclude = {
    Team: { include: { Country: true } },
    TableCategory: true,
    TableSection: true,
  };
  const orderBy = { rank: "asc" as const };

  const [defensive, offensive, summary, xg] = await Promise.all([
    db.tournamentTableDefensive.findMany({
      where: { tournamentId },
      include: {
        ...baseInclude,
        TableType_TournamentTableDefensive_typeIdToTableType: true,
        TableType_TournamentTableDefensive_viewTypeIdToTableType: true,
      },
      orderBy,
    }),
    db.tournamentTableOffensive.findMany({
      where: { tournamentId },
      include: {
        ...baseInclude,
        TableType_TournamentTableOffensive_typeIdToTableType: true,
        TableType_TournamentTableOffensive_viewTypeIdToTableType: true,
      },
      orderBy,
    }),
    db.tournamentTableSummary.findMany({
      where: { tournamentId },
      include: {
        ...baseInclude,
        TableType_TournamentTableSummary_typeIdToTableType: true,
        TableType_TournamentTableSummary_viewTypeIdToTableType: true,
      },
      orderBy,
    }),
    db.tournamentTableXG.findMany({
      where: { tournamentId },
      include: {
        ...baseInclude,
        TableType_TournamentTableXG_typeIdToTableType: true,
        TableType_TournamentTableXG_viewTypeIdToTableType: true,
      },
      orderBy,
    }),
  ]);

  return { defensive, offensive, summary, xg };
}

