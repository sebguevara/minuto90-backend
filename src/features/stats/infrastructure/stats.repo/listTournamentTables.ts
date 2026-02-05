import { whoscoredPrismaClient } from "../../../../lib/whoscored-client";
import type {
  PaginationQuery,
  TournamentTableType,
} from "../../dtos/stats.dto";

export async function listTournamentTables(
  tournamentId: number,
  viewTypeId: number,
  type: TournamentTableType | undefined,
  categoryId: number | undefined,
  sectionId: number | undefined,
  typeId: number | undefined,
  pagination: PaginationQuery
) {
  const db = whoscoredPrismaClient;
  // Source of truth: Table* models (TableSummary/TableOffensive/TableDefensive/TableXG).
  // These use `typeId` for Overall/Home/Away, so we map `viewTypeId` → `typeId`.
  // `typeId` query param from the legacy TournamentTable* models is ignored here.
  const baseWhere = {
    tournamentId,
    typeId: viewTypeId,
    ...(categoryId && { categoryId }),
  };

  const commonInclude = {
    Team: { include: { Country: true } },
    Tournament: { include: { Country: true, Region: true } },
    TableCategory: true,
    TableType: true,
    TableSection: true,
  };

  if (type === "defensive") {
    const where = {
      ...baseWhere,
      ...(sectionId && { tableSectionId: sectionId }),
    };
    const [items, total] = await Promise.all([
      db.tableDefensive.findMany({
        where,
        include: commonInclude,
        take: pagination.limit,
        skip: pagination.offset,
        orderBy: { rank: "asc" },
      }),
      db.tableDefensive.count({ where }),
    ]);
    return {
      items: items.map((r: any) => ({
        ...r,
        viewTypeId: r.typeId,
        sectionId: r.tableSectionId,
        TableType_TournamentTableDefensive_typeIdToTableType: r.TableType,
        TableType_TournamentTableDefensive_viewTypeIdToTableType: r.TableType,
      })),
      total,
    };
  }

  if (type === "offensive") {
    const where = {
      ...baseWhere,
      ...(sectionId && { tableSectionId: sectionId }),
    };
    const [items, total] = await Promise.all([
      db.tableOffensive.findMany({
        where,
        include: commonInclude,
        take: pagination.limit,
        skip: pagination.offset,
        orderBy: { rank: "asc" },
      }),
      db.tableOffensive.count({ where }),
    ]);
    return {
      items: items.map((r: any) => ({
        ...r,
        viewTypeId: r.typeId,
        sectionId: r.tableSectionId,
        TableType_TournamentTableOffensive_typeIdToTableType: r.TableType,
        TableType_TournamentTableOffensive_viewTypeIdToTableType: r.TableType,
      })),
      total,
    };
  }

  if (type === "summary") {
    const where = {
      ...baseWhere,
      ...(sectionId && { tableSectionId: sectionId }),
    };
    const [items, total] = await Promise.all([
      db.tableSummary.findMany({
        where,
        include: commonInclude,
        take: pagination.limit,
        skip: pagination.offset,
        orderBy: { rank: "asc" },
      }),
      db.tableSummary.count({ where }),
    ]);
    return {
      items: items.map((r: any) => ({
        ...r,
        viewTypeId: r.typeId,
        sectionId: r.tableSectionId,
        TableType_TournamentTableSummary_typeIdToTableType: r.TableType,
        TableType_TournamentTableSummary_viewTypeIdToTableType: r.TableType,
      })),
      total,
    };
  }

  if (type === "xg") {
    const where = {
      ...baseWhere,
      ...(sectionId && { sectionId }),
    };
    const [items, total] = await Promise.all([
      db.tableXG.findMany({
        where,
        include: commonInclude,
        take: pagination.limit,
        skip: pagination.offset,
        orderBy: { rank: "asc" },
      }),
      db.tableXG.count({ where }),
    ]);
    return {
      items: items.map((r: any) => ({
        ...r,
        viewTypeId: r.typeId,
        TableType_TournamentTableXG_typeIdToTableType: r.TableType,
        TableType_TournamentTableXG_viewTypeIdToTableType: r.TableType,
      })),
      total,
    };
  }

  const whereDefOffSum = {
    ...baseWhere,
    ...(sectionId && { tableSectionId: sectionId }),
  };
  const whereXg = {
    ...baseWhere,
    ...(sectionId && { sectionId }),
  };

  const [defensive, offensive, summary, xg] = await Promise.all([
    db.tableDefensive.findMany({
      where: whereDefOffSum,
      include: commonInclude,
      take: pagination.limit,
      skip: pagination.offset,
      orderBy: { rank: "asc" },
    }),
    db.tableOffensive.findMany({
      where: whereDefOffSum,
      include: commonInclude,
      take: pagination.limit,
      skip: pagination.offset,
      orderBy: { rank: "asc" },
    }),
    db.tableSummary.findMany({
      where: whereDefOffSum,
      include: commonInclude,
      take: pagination.limit,
      skip: pagination.offset,
      orderBy: { rank: "asc" },
    }),
    db.tableXG.findMany({
      where: whereXg,
      include: commonInclude,
      take: pagination.limit,
      skip: pagination.offset,
      orderBy: { rank: "asc" },
    }),
  ]);

  return {
    items: {
      defensive: defensive.map((r: any) => ({
        ...r,
        viewTypeId: r.typeId,
        sectionId: r.tableSectionId,
        TableType_TournamentTableDefensive_typeIdToTableType: r.TableType,
        TableType_TournamentTableDefensive_viewTypeIdToTableType: r.TableType,
      })),
      offensive: offensive.map((r: any) => ({
        ...r,
        viewTypeId: r.typeId,
        sectionId: r.tableSectionId,
        TableType_TournamentTableOffensive_typeIdToTableType: r.TableType,
        TableType_TournamentTableOffensive_viewTypeIdToTableType: r.TableType,
      })),
      summary: summary.map((r: any) => ({
        ...r,
        viewTypeId: r.typeId,
        sectionId: r.tableSectionId,
        TableType_TournamentTableSummary_typeIdToTableType: r.TableType,
        TableType_TournamentTableSummary_viewTypeIdToTableType: r.TableType,
      })),
      xg: xg.map((r: any) => ({
        ...r,
        viewTypeId: r.typeId,
        TableType_TournamentTableXG_typeIdToTableType: r.TableType,
        TableType_TournamentTableXG_viewTypeIdToTableType: r.TableType,
      })),
    },
    total: 0,
  };
}
