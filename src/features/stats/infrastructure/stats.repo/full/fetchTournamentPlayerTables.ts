import { whoscoredPrismaClient } from "../../../../../lib/whoscored-client";

export async function fetchTournamentPlayerTables(
  tournamentId: number,
  source: "tournament" | "global" = "tournament"
) {
  const db = whoscoredPrismaClient;
  const orderBy = { rank: "asc" as const };

  if (source === "global") {
    const baseInclude = {
      Player: { include: { Country: true } },
      Team: { include: { Country: true } },
      TableCategory: true,
      TableType: true,
    };

    const [defensive, offensive, passing, summary, xg] = await Promise.all([
      db.playerTableDefensive.findMany({ include: baseInclude, orderBy }),
      db.playerTableOffensive.findMany({ include: baseInclude, orderBy }),
      db.playerTablePassing.findMany({ include: baseInclude, orderBy }),
      db.playerTableSummary.findMany({ include: baseInclude, orderBy }),
      db.playerTableXG.findMany({
        include: { ...baseInclude, TableSection: true },
        orderBy,
      }),
    ]);

    const mapApps = (apps: unknown) => (apps === null || apps === undefined ? "" : String(apps));

    return {
      defensive: defensive.map((r) => ({
        ...r,
        tournamentId,
        viewTypeId: r.typeId,
        categoryId: r.categoryId ?? null,
        typeId: r.typeId ?? null,
        sectionId: null,
        apps: mapApps((r as any).apps),
        TableType_TournamentPlayerTableDefensive_typeIdToTableType: r.TableType,
        TableType_TournamentPlayerTableDefensive_viewTypeIdToTableType: r.TableType,
      })),
      offensive: offensive.map((r) => ({
        ...r,
        tournamentId,
        viewTypeId: r.typeId,
        categoryId: r.categoryId ?? null,
        typeId: r.typeId ?? null,
        sectionId: null,
        apps: mapApps((r as any).apps),
        TableType_TournamentPlayerTableOffensive_typeIdToTableType: r.TableType,
        TableType_TournamentPlayerTableOffensive_viewTypeIdToTableType: r.TableType,
      })),
      passing: passing.map((r) => ({
        ...r,
        tournamentId,
        viewTypeId: r.typeId,
        categoryId: r.categoryId ?? null,
        typeId: r.typeId ?? null,
        sectionId: null,
        apps: mapApps((r as any).apps),
        TableType_TournamentPlayerTablePassing_typeIdToTableType: r.TableType,
        TableType_TournamentPlayerTablePassing_viewTypeIdToTableType: r.TableType,
      })),
      summary: summary.map((r) => ({
        ...r,
        tournamentId,
        viewTypeId: r.typeId,
        categoryId: r.categoryId ?? null,
        typeId: r.typeId ?? null,
        sectionId: null,
        apps: mapApps((r as any).apps),
        TableType_TournamentPlayerTableSummary_typeIdToTableType: r.TableType,
        TableType_TournamentPlayerTableSummary_viewTypeIdToTableType: r.TableType,
      })),
      xg: xg.map((r) => ({
        ...r,
        tournamentId,
        viewTypeId: r.typeId,
        categoryId: r.categoryId ?? null,
        typeId: r.typeId ?? null,
        sectionId: (r as any).sectionId ?? null,
        apps: mapApps((r as any).apps),
        // Compat: estos campos existen en TournamentPlayerTableXG pero no en PlayerTableXG
        npxG: null,
        xGAssist: null,
        xGChain: null,
        xGBuildup: null,
        // Exponer extras para una UI alternativa
        xG90: (r as any).xG90 ?? null,
        xGDiff: (r as any).xGDiff ?? null,
        xGPerShot: (r as any).xGPerShot ?? null,
        goals: (r as any).goals ?? null,
        shots: (r as any).shots ?? null,
        TableType_TournamentPlayerTableXG_typeIdToTableType: r.TableType,
        TableType_TournamentPlayerTableXG_viewTypeIdToTableType: r.TableType,
      })),
    };
  }

  const baseInclude = {
    Player: { include: { Country: true } },
    Team: { include: { Country: true } },
    TableCategory: true,
    TableSection: true,
  };

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

  console.log(
    `[fetchTournamentPlayerTables] tournamentId=${tournamentId} → ` +
    `summary=${summary.length}(ids: ${summary.slice(0,3).map(r => r.id)}) | ` +
    `offensive=${offensive.length}(ids: ${offensive.slice(0,3).map(r => r.id)}) | ` +
    `defensive=${defensive.length}(ids: ${defensive.slice(0,3).map(r => r.id)}) | ` +
    `passing=${passing.length}(ids: ${passing.slice(0,3).map(r => r.id)}) | ` +
    `xg=${xg.length}(ids: ${xg.slice(0,3).map(r => r.id)})`
  );

  return { defensive, offensive, passing, summary, xg };
}
