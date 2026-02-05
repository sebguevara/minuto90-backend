import { whoscoredPrismaClient } from "../../../../../lib/whoscored-client";

export async function fetchTournamentPlayerTables(tournamentId: number) {
  const db = whoscoredPrismaClient;
  const baseInclude = {
    Player: { include: { Country: true } },
    Team: { include: { Country: true } },
    TableCategory: true,
    TableSection: true,
  };
  const orderBy = { rank: "asc" as const };

  const [defensive, offensive, passing, summary, xg] = await Promise.all([
    db.tournamentPlayerTableDefensive.findMany({
      where: { tournamentId },
      include: {
        ...baseInclude,
        TableType_TournamentPlayerTableDefensive_typeIdToTableType: true,
        TableType_TournamentPlayerTableDefensive_viewTypeIdToTableType: true,
      },
      orderBy,
    }),
    db.tournamentPlayerTableOffensive.findMany({
      where: { tournamentId },
      include: {
        ...baseInclude,
        TableType_TournamentPlayerTableOffensive_typeIdToTableType: true,
        TableType_TournamentPlayerTableOffensive_viewTypeIdToTableType: true,
      },
      orderBy,
    }),
    db.tournamentPlayerTablePassing.findMany({
      where: { tournamentId },
      include: {
        ...baseInclude,
        TableType_TournamentPlayerTablePassing_typeIdToTableType: true,
        TableType_TournamentPlayerTablePassing_viewTypeIdToTableType: true,
      },
      orderBy,
    }),
    db.tournamentPlayerTableSummary.findMany({
      where: { tournamentId },
      include: {
        ...baseInclude,
        TableType_TournamentPlayerTableSummary_typeIdToTableType: true,
        TableType_TournamentPlayerTableSummary_viewTypeIdToTableType: true,
      },
      orderBy,
    }),
    db.tournamentPlayerTableXG.findMany({
      where: { tournamentId },
      include: {
        ...baseInclude,
        TableType_TournamentPlayerTableXG_typeIdToTableType: true,
        TableType_TournamentPlayerTableXG_viewTypeIdToTableType: true,
      },
      orderBy,
    }),
  ]);

  return { defensive, offensive, passing, summary, xg };
}

