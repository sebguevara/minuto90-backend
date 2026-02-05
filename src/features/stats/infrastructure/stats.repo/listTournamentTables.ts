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
  const baseWhere = {
    tournamentId,
    viewTypeId,
    ...(categoryId && { categoryId }),
    ...(sectionId && { sectionId }),
    ...(typeId && { typeId }),
  };

  const commonInclude = {
    Team: { include: { Country: true } },
    Tournament: { include: { Country: true, Region: true } },
    TableCategory: true,
    TableSection: true,
  };

  if (type === "defensive") {
    const [items, total] = await Promise.all([
      db.tournamentTableDefensive.findMany({
        where: baseWhere,
        include: {
          ...commonInclude,
          TableType_TournamentTableDefensive_typeIdToTableType: true,
          TableType_TournamentTableDefensive_viewTypeIdToTableType: true,
        },
        take: pagination.limit,
        skip: pagination.offset,
        orderBy: { rank: "asc" },
      }),
      db.tournamentTableDefensive.count({ where: baseWhere }),
    ]);
    return { items, total };
  }

  if (type === "offensive") {
    const [items, total] = await Promise.all([
      db.tournamentTableOffensive.findMany({
        where: baseWhere,
        include: {
          ...commonInclude,
          TableType_TournamentTableOffensive_typeIdToTableType: true,
          TableType_TournamentTableOffensive_viewTypeIdToTableType: true,
        },
        take: pagination.limit,
        skip: pagination.offset,
        orderBy: { rank: "asc" },
      }),
      db.tournamentTableOffensive.count({ where: baseWhere }),
    ]);
    return { items, total };
  }

  if (type === "summary") {
    const [items, total] = await Promise.all([
      db.tournamentTableSummary.findMany({
        where: baseWhere,
        include: {
          ...commonInclude,
          TableType_TournamentTableSummary_typeIdToTableType: true,
          TableType_TournamentTableSummary_viewTypeIdToTableType: true,
        },
        take: pagination.limit,
        skip: pagination.offset,
        orderBy: { rank: "asc" },
      }),
      db.tournamentTableSummary.count({ where: baseWhere }),
    ]);
    return { items, total };
  }

  if (type === "xg") {
    const [items, total] = await Promise.all([
      db.tournamentTableXG.findMany({
        where: baseWhere,
        include: {
          ...commonInclude,
          TableType_TournamentTableXG_typeIdToTableType: true,
          TableType_TournamentTableXG_viewTypeIdToTableType: true,
        },
        take: pagination.limit,
        skip: pagination.offset,
        orderBy: { rank: "asc" },
      }),
      db.tournamentTableXG.count({ where: baseWhere }),
    ]);
    return { items, total };
  }

  const [defensive, offensive, summary, xg] = await Promise.all([
    db.tournamentTableDefensive.findMany({
      where: baseWhere,
      include: {
        ...commonInclude,
        TableType_TournamentTableDefensive_typeIdToTableType: true,
        TableType_TournamentTableDefensive_viewTypeIdToTableType: true,
      },
      take: pagination.limit,
      skip: pagination.offset,
      orderBy: { rank: "asc" },
    }),
    db.tournamentTableOffensive.findMany({
      where: baseWhere,
      include: {
        ...commonInclude,
        TableType_TournamentTableOffensive_typeIdToTableType: true,
        TableType_TournamentTableOffensive_viewTypeIdToTableType: true,
      },
      take: pagination.limit,
      skip: pagination.offset,
      orderBy: { rank: "asc" },
    }),
    db.tournamentTableSummary.findMany({
      where: baseWhere,
      include: {
        ...commonInclude,
        TableType_TournamentTableSummary_typeIdToTableType: true,
        TableType_TournamentTableSummary_viewTypeIdToTableType: true,
      },
      take: pagination.limit,
      skip: pagination.offset,
      orderBy: { rank: "asc" },
    }),
    db.tournamentTableXG.findMany({
      where: baseWhere,
      include: {
        ...commonInclude,
        TableType_TournamentTableXG_typeIdToTableType: true,
        TableType_TournamentTableXG_viewTypeIdToTableType: true,
      },
      take: pagination.limit,
      skip: pagination.offset,
      orderBy: { rank: "asc" },
    }),
  ]);

  return { items: { defensive, offensive, summary, xg }, total: 0 };
}
