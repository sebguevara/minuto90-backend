import { whoscoredPrismaClient } from "../../../../lib/whoscored-client";
import type {
  PaginationQuery,
  TournamentPlayerTableType,
} from "../../dtos/stats.dto";

function parseApps(apps: string): number {
  const match = /^\d+/.exec(apps.trim());
  return match ? Number(match[0]) : 0;
}

export async function listTournamentPlayerTables(
  tournamentId: number,
  viewTypeId: number,
  type: TournamentPlayerTableType | undefined,
  categoryId: number | undefined,
  sectionId: number | undefined,
  typeId: number | undefined,
  minApps: number | undefined,
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

  const includeConfig = {
    Player: { include: { Country: true } },
    Team: { include: { Country: true } },
    Tournament: { include: { Country: true, Region: true } },
    TableCategory: true,
    TableSection: true,
  };

  if (type === "defensive") {
    if (minApps !== undefined) {
      const all = await db.tournamentPlayerTableDefensive.findMany({
        where: baseWhere,
        include: {
          ...includeConfig,
          TableType_TournamentPlayerTableDefensive_typeIdToTableType: true,
          TableType_TournamentPlayerTableDefensive_viewTypeIdToTableType: true,
        },
        orderBy: { rank: "asc" },
      });

      const filtered = all.filter((row) => parseApps(row.apps) >= minApps);
      return {
        items: filtered.slice(pagination.offset, pagination.offset + pagination.limit),
        total: filtered.length,
      };
    }

    const [items, total] = await Promise.all([
      db.tournamentPlayerTableDefensive.findMany({
        where: baseWhere,
        include: {
          ...includeConfig,
          TableType_TournamentPlayerTableDefensive_typeIdToTableType: true,
          TableType_TournamentPlayerTableDefensive_viewTypeIdToTableType: true,
        },
        take: pagination.limit,
        skip: pagination.offset,
        orderBy: { rank: "asc" },
      }),
      db.tournamentPlayerTableDefensive.count({ where: baseWhere }),
    ]);
    return { items, total };
  }

  if (type === "offensive") {
    if (minApps !== undefined) {
      const all = await db.tournamentPlayerTableOffensive.findMany({
        where: baseWhere,
        include: {
          ...includeConfig,
          TableType_TournamentPlayerTableOffensive_typeIdToTableType: true,
          TableType_TournamentPlayerTableOffensive_viewTypeIdToTableType: true,
        },
        orderBy: { rank: "asc" },
      });

      const filtered = all.filter((row) => parseApps(row.apps) >= minApps);
      return {
        items: filtered.slice(pagination.offset, pagination.offset + pagination.limit),
        total: filtered.length,
      };
    }

    const [items, total] = await Promise.all([
      db.tournamentPlayerTableOffensive.findMany({
        where: baseWhere,
        include: {
          ...includeConfig,
          TableType_TournamentPlayerTableOffensive_typeIdToTableType: true,
          TableType_TournamentPlayerTableOffensive_viewTypeIdToTableType: true,
        },
        take: pagination.limit,
        skip: pagination.offset,
        orderBy: { rank: "asc" },
      }),
      db.tournamentPlayerTableOffensive.count({ where: baseWhere }),
    ]);
    return { items, total };
  }

  if (type === "passing") {
    if (minApps !== undefined) {
      const all = await db.tournamentPlayerTablePassing.findMany({
        where: baseWhere,
        include: {
          ...includeConfig,
          TableType_TournamentPlayerTablePassing_typeIdToTableType: true,
          TableType_TournamentPlayerTablePassing_viewTypeIdToTableType: true,
        },
        orderBy: { rank: "asc" },
      });

      const filtered = all.filter((row) => parseApps(row.apps) >= minApps);
      return {
        items: filtered.slice(pagination.offset, pagination.offset + pagination.limit),
        total: filtered.length,
      };
    }

    const [items, total] = await Promise.all([
      db.tournamentPlayerTablePassing.findMany({
        where: baseWhere,
        include: {
          ...includeConfig,
          TableType_TournamentPlayerTablePassing_typeIdToTableType: true,
          TableType_TournamentPlayerTablePassing_viewTypeIdToTableType: true,
        },
        take: pagination.limit,
        skip: pagination.offset,
        orderBy: { rank: "asc" },
      }),
      db.tournamentPlayerTablePassing.count({ where: baseWhere }),
    ]);
    return { items, total };
  }

  if (type === "summary") {
    if (minApps !== undefined) {
      const all = await db.tournamentPlayerTableSummary.findMany({
        where: baseWhere,
        include: {
          ...includeConfig,
          TableType_TournamentPlayerTableSummary_typeIdToTableType: true,
          TableType_TournamentPlayerTableSummary_viewTypeIdToTableType: true,
        },
        orderBy: { rank: "asc" },
      });

      const filtered = all.filter((row) => parseApps(row.apps) >= minApps);
      return {
        items: filtered.slice(pagination.offset, pagination.offset + pagination.limit),
        total: filtered.length,
      };
    }

    const [items, total] = await Promise.all([
      db.tournamentPlayerTableSummary.findMany({
        where: baseWhere,
        include: {
          ...includeConfig,
          TableType_TournamentPlayerTableSummary_typeIdToTableType: true,
          TableType_TournamentPlayerTableSummary_viewTypeIdToTableType: true,
        },
        take: pagination.limit,
        skip: pagination.offset,
        orderBy: { rank: "asc" },
      }),
      db.tournamentPlayerTableSummary.count({ where: baseWhere }),
    ]);
    return { items, total };
  }

  if (type === "xg") {
    if (minApps !== undefined) {
      const all = await db.tournamentPlayerTableXG.findMany({
        where: baseWhere,
        include: {
          ...includeConfig,
          TableType_TournamentPlayerTableXG_typeIdToTableType: true,
          TableType_TournamentPlayerTableXG_viewTypeIdToTableType: true,
        },
        orderBy: { rank: "asc" },
      });

      const filtered = all.filter((row) => parseApps(row.apps) >= minApps);
      return {
        items: filtered.slice(pagination.offset, pagination.offset + pagination.limit),
        total: filtered.length,
      };
    }

    const [items, total] = await Promise.all([
      db.tournamentPlayerTableXG.findMany({
        where: baseWhere,
        include: {
          ...includeConfig,
          TableType_TournamentPlayerTableXG_typeIdToTableType: true,
          TableType_TournamentPlayerTableXG_viewTypeIdToTableType: true,
        },
        take: pagination.limit,
        skip: pagination.offset,
        orderBy: { rank: "asc" },
      }),
      db.tournamentPlayerTableXG.count({ where: baseWhere }),
    ]);
    return { items, total };
  }

  const [items, total] = await Promise.all([
    db.tournamentPlayerTableSummary.findMany({
      where: baseWhere,
      include: {
        ...includeConfig,
        TableType_TournamentPlayerTableSummary_typeIdToTableType: true,
        TableType_TournamentPlayerTableSummary_viewTypeIdToTableType: true,
      },
      take: pagination.limit,
      skip: pagination.offset,
      orderBy: { rank: "asc" },
    }),
    db.tournamentPlayerTableSummary.count({ where: baseWhere }),
  ]);

  return { items, total };
}
