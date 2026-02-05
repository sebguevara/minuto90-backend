import { whoscoredPrismaClient } from "../../../../../lib/whoscored-client";

export async function fetchTournamentTables(tournamentId: number) {
  const db = whoscoredPrismaClient;
  const orderBy = { rank: "asc" as const };

  const [defensive, offensive, summary, xg] = await Promise.all([
    db.tableDefensive.findMany({
      where: { tournamentId },
      include: {
        Team: { include: { Country: true } },
        TableCategory: true,
        TableSection: true,
        TableType: true,
      },
      orderBy,
    }),
    db.tableOffensive.findMany({
      where: { tournamentId },
      include: {
        Team: { include: { Country: true } },
        TableCategory: true,
        TableSection: true,
        TableType: true,
      },
      orderBy,
    }),
    db.tableSummary.findMany({
      where: { tournamentId },
      include: {
        Team: { include: { Country: true } },
        TableCategory: true,
        TableSection: true,
        TableType: true,
      },
      orderBy,
    }),
    db.tableXG.findMany({
      where: { tournamentId },
      include: {
        Team: { include: { Country: true } },
        TableCategory: true,
        TableSection: true,
        TableType: true,
      },
      orderBy,
    }),
  ]);

  return {
    defensive: defensive.map((r) => ({
      ...r,
      viewTypeId: r.typeId,
      sectionId: r.tableSectionId,
      TableType_TournamentTableDefensive_typeIdToTableType: r.TableType,
      TableType_TournamentTableDefensive_viewTypeIdToTableType: r.TableType,
    })),
    offensive: offensive.map((r) => ({
      ...r,
      viewTypeId: r.typeId,
      sectionId: r.tableSectionId,
      TableType_TournamentTableOffensive_typeIdToTableType: r.TableType,
      TableType_TournamentTableOffensive_viewTypeIdToTableType: r.TableType,
    })),
    summary: summary.map((r) => ({
      ...r,
      viewTypeId: r.typeId,
      sectionId: r.tableSectionId,
      TableType_TournamentTableSummary_typeIdToTableType: r.TableType,
      TableType_TournamentTableSummary_viewTypeIdToTableType: r.TableType,
    })),
    xg: xg.map((r) => ({
      ...r,
      viewTypeId: r.typeId,
      TableType_TournamentTableXG_typeIdToTableType: r.TableType,
      TableType_TournamentTableXG_viewTypeIdToTableType: r.TableType,
    })),
  };
}
