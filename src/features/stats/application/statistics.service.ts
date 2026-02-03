import * as repo from "../infrastructure/statistics.repo";
import type { PaginationOptions } from "../dtos/stats.dto";

// ==================== ESTADÍSTICAS DE EQUIPOS ====================

export async function getTeamSummaryStats(
  tournamentId: number,
  viewTypeId: number,
  categoryId?: number,
  sectionId?: number,
  pagination?: PaginationOptions
) {
  const result = await repo.fetchTeamSummaryStats(
    tournamentId,
    viewTypeId,
    categoryId,
    sectionId,
    pagination
  );

  return {
    data: result.items,
    meta: {
      limit: pagination?.limit || 20,
      offset: pagination?.offset || 0,
      count: result.total,
    },
  };
}

export async function getTeamDefensiveStats(
  tournamentId: number,
  viewTypeId: number,
  categoryId?: number,
  sectionId?: number,
  pagination?: PaginationOptions
) {
  const result = await repo.fetchTeamDefensiveStats(
    tournamentId,
    viewTypeId,
    categoryId,
    sectionId,
    pagination
  );

  return {
    data: result.items,
    meta: {
      limit: pagination?.limit || 20,
      offset: pagination?.offset || 0,
      count: result.total,
    },
  };
}

export async function getTeamOffensiveStats(
  tournamentId: number,
  viewTypeId: number,
  categoryId?: number,
  sectionId?: number,
  pagination?: PaginationOptions
) {
  const result = await repo.fetchTeamOffensiveStats(
    tournamentId,
    viewTypeId,
    categoryId,
    sectionId,
    pagination
  );

  return {
    data: result.items,
    meta: {
      limit: pagination?.limit || 20,
      offset: pagination?.offset || 0,
      count: result.total,
    },
  };
}

export async function getTeamXGStats(
  tournamentId: number,
  viewTypeId: number,
  categoryId?: number,
  sectionId?: number,
  pagination?: PaginationOptions
) {
  const result = await repo.fetchTeamXGStats(
    tournamentId,
    viewTypeId,
    categoryId,
    sectionId,
    pagination
  );

  return {
    data: result.items,
    meta: {
      limit: pagination?.limit || 20,
      offset: pagination?.offset || 0,
      count: result.total,
    },
  };
}

// ==================== ESTADÍSTICAS DE JUGADORES ====================

export async function getPlayerSummaryStats(
  tournamentId: number,
  viewTypeId: number,
  categoryId?: number,
  sectionId?: number,
  pagination?: PaginationOptions
) {
  const result = await repo.fetchPlayerSummaryStats(
    tournamentId,
    viewTypeId,
    categoryId,
    sectionId,
    pagination
  );

  return {
    data: result.items,
    meta: {
      limit: pagination?.limit || 20,
      offset: pagination?.offset || 0,
      count: result.total,
    },
  };
}

export async function getPlayerDefensiveStats(
  tournamentId: number,
  viewTypeId: number,
  categoryId?: number,
  sectionId?: number,
  pagination?: PaginationOptions
) {
  const result = await repo.fetchPlayerDefensiveStats(
    tournamentId,
    viewTypeId,
    categoryId,
    sectionId,
    pagination
  );

  return {
    data: result.items,
    meta: {
      limit: pagination?.limit || 20,
      offset: pagination?.offset || 0,
      count: result.total,
    },
  };
}

export async function getPlayerOffensiveStats(
  tournamentId: number,
  viewTypeId: number,
  categoryId?: number,
  sectionId?: number,
  pagination?: PaginationOptions
) {
  const result = await repo.fetchPlayerOffensiveStats(
    tournamentId,
    viewTypeId,
    categoryId,
    sectionId,
    pagination
  );

  return {
    data: result.items,
    meta: {
      limit: pagination?.limit || 20,
      offset: pagination?.offset || 0,
      count: result.total,
    },
  };
}

export async function getPlayerPassingStats(
  tournamentId: number,
  viewTypeId: number,
  categoryId?: number,
  sectionId?: number,
  pagination?: PaginationOptions
) {
  const result = await repo.fetchPlayerPassingStats(
    tournamentId,
    viewTypeId,
    categoryId,
    sectionId,
    pagination
  );

  return {
    data: result.items,
    meta: {
      limit: pagination?.limit || 20,
      offset: pagination?.offset || 0,
      count: result.total,
    },
  };
}

export async function getPlayerXGStats(
  tournamentId: number,
  viewTypeId: number,
  categoryId?: number,
  sectionId?: number,
  pagination?: PaginationOptions
) {
  const result = await repo.fetchPlayerXGStats(
    tournamentId,
    viewTypeId,
    categoryId,
    sectionId,
    pagination
  );

  return {
    data: result.items,
    meta: {
      limit: pagination?.limit || 20,
      offset: pagination?.offset || 0,
      count: result.total,
    },
  };
}

// ==================== RACHAS ====================

export async function getTeamStreaks(
  tournamentId: number,
  viewTypeId: number,
  mode: string = "all",
  scope: string = "Current",
  pagination?: PaginationOptions
) {
  const result = await repo.fetchTeamStreaks(
    tournamentId,
    viewTypeId,
    mode,
    scope,
    pagination
  );

  return {
    data: result.items,
    meta: {
      limit: pagination?.limit || 20,
      offset: pagination?.offset || 0,
      count: result.total,
    },
  };
}

// ==================== RENDIMIENTOS ====================

export async function getTeamPerformance(
  tournamentId: number,
  viewTypeId: number,
  mode: string = "all",
  pagination?: PaginationOptions
) {
  const result = await repo.fetchTeamPerformance(
    tournamentId,
    viewTypeId,
    mode,
    pagination
  );

  return {
    data: result.items,
    meta: {
      limit: pagination?.limit || 20,
      offset: pagination?.offset || 0,
      count: result.total,
    },
  };
}

// ==================== XI IDEAL ====================

export async function getBestXI(
  tournamentId: number,
  timeframe: string = "season",
  startDate?: Date,
  endDate?: Date
) {
  const bestXI = await repo.fetchBestXI(tournamentId, timeframe, startDate, endDate);

  if (!bestXI) {
    throw new Error("Best XI not found for the specified criteria");
  }

  return {
    data: bestXI,
  };
}

// ==================== TOP PLAYERS ====================

export async function getTopPlayersByRating(
  tournamentId: number,
  viewTypeId: number,
  limit: number = 10
) {
  const players = await repo.fetchTopPlayersByRating(tournamentId, viewTypeId, limit);

  return {
    data: players,
    meta: {
      limit,
      count: players.length,
    },
  };
}

export async function getTopPlayersByAssists(
  tournamentId: number,
  viewTypeId: number,
  limit: number = 10
) {
  const players = await repo.fetchTopPlayersByAssists(tournamentId, viewTypeId, limit);

  return {
    data: players,
    meta: {
      limit,
      count: players.length,
    },
  };
}

export async function getTopPlayersByShots(
  tournamentId: number,
  viewTypeId: number,
  limit: number = 10
) {
  const players = await repo.fetchTopPlayersByShots(tournamentId, viewTypeId, limit);

  return {
    data: players,
    meta: {
      limit,
      count: players.length,
    },
  };
}

export async function getTopPlayersByAggression(
  tournamentId: number,
  viewTypeId: number,
  limit: number = 10
) {
  const players = await repo.fetchTopPlayersByAggression(tournamentId, viewTypeId, limit);

  return {
    data: players,
    meta: {
      limit,
      count: players.length,
    },
  };
}

export async function getTopPlayersByGoalContribution(
  tournamentId: number,
  viewTypeId: number,
  limit: number = 10
) {
  const players = await repo.fetchTopPlayersByGoalContribution(tournamentId, viewTypeId, limit);

  return {
    data: players,
    meta: {
      limit,
      count: players.length,
    },
  };
}
