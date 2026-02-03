import * as repo from "../infrastructure/stats.repo";
import type {
  PaginationQuery,
  TeamTournamentsQuery,
  TeamPerformanceQuery,
  TeamPositionalQuery,
  TeamSituationalQuery,
  TeamStreaksQuery,
  TeamTopPlayersQuery,
  TournamentTeamsQuery,
  TournamentTablesQuery,
  TournamentPlayerTablesQuery,
  TournamentBestXIQuery,
} from "../dtos/stats.dto";

// ==================== TEAM SERVICES ====================

export async function getTeamByMinId(minId: number) {
  const team = await repo.findTeamByMinId(minId);
  if (!team) {
    throw new Error("Team not found");
  }
  return team;
}

export async function getTeamTournaments(
  minId: number,
  query: TeamTournamentsQuery
) {
  const team = await getTeamByMinId(minId);
  const result = await repo.listTeamTournaments(
    team.id,
    { limit: query.limit, offset: query.offset },
    query.seasonId
  );

  return {
    data: result.items,
    meta: {
      limit: query.limit,
      offset: query.offset,
      count: result.total,
    },
  };
}

export async function getTeamPerformance(
  minId: number,
  query: TeamPerformanceQuery
) {
  const team = await getTeamByMinId(minId);
  const result = await repo.listTeamPerformance(team.id, query);

  return {
    data: result.items,
    meta: {
      limit: query.limit,
      offset: query.offset,
      count: result.total,
    },
  };
}

export async function getTeamPositional(
  minId: number,
  query: TeamPositionalQuery
) {
  const team = await getTeamByMinId(minId);
  const result = await repo.listTeamPositional(team.id, query);

  return {
    data: result.items,
    meta: {
      limit: query.limit,
      offset: query.offset,
      count: result.total,
    },
  };
}

export async function getTeamSituational(
  minId: number,
  query: TeamSituationalQuery
) {
  const team = await getTeamByMinId(minId);
  const result = await repo.listTeamSituational(team.id, query);

  return {
    data: result.items,
    meta: {
      limit: query.limit,
      offset: query.offset,
      count: result.total,
    },
  };
}

export async function getTeamStreaks(minId: number, query: TeamStreaksQuery) {
  const team = await getTeamByMinId(minId);
  const result = await repo.listTeamStreaks(team.id, query);

  return {
    data: result.items,
    meta: {
      limit: query.limit,
      offset: query.offset,
      count: result.total,
    },
  };
}

export async function getTeamTopPlayers(
  minId: number,
  query: TeamTopPlayersQuery
) {
  const team = await getTeamByMinId(minId);
  const items = await repo.listTeamTopPlayers(
    team.id,
    query.tournamentId,
    query.viewTypeId,
    query.metric,
    query.limit
  );

  return {
    data: items,
    meta: {
      limit: query.limit,
      count: items.length,
    },
  };
}

export async function getTeamTournamentBundle(
  minId: number,
  tournamentId: number
) {
  const team = await getTeamByMinId(minId);
  const tables = await repo.listTeamTables(team.id, tournamentId, 0);

  return {
    data: {
      team,
      tournamentId,
      tables,
    },
  };
}

// ==================== TOURNAMENT SERVICES ====================

export async function getTournamentByMinId(minId: number) {
  const tournament = await repo.findTournamentByMinId(minId);
  if (!tournament) {
    throw new Error("Tournament not found");
  }
  return tournament;
}

export async function getTournamentTeams(
  minId: number,
  query: TournamentTeamsQuery
) {
  const tournament = await getTournamentByMinId(minId);
  const result = await repo.listTournamentTeams(
    tournament.id,
    { limit: query.limit, offset: query.offset },
    query.seasonId
  );

  return {
    data: result.items,
    meta: {
      limit: query.limit,
      offset: query.offset,
      count: result.total,
    },
  };
}

export async function getTournamentTables(
  minId: number,
  query: TournamentTablesQuery
) {
  const tournament = await getTournamentByMinId(minId);
  const result = await repo.listTournamentTables(
    tournament.id,
    query.viewTypeId,
    query.type,
    query.categoryId,
    query.sectionId,
    { limit: query.limit, offset: query.offset }
  );

  return {
    data: result.items,
    meta: {
      limit: query.limit,
      offset: query.offset,
      count: result.total,
    },
  };
}

export async function getTournamentPlayerTables(
  minId: number,
  query: TournamentPlayerTablesQuery
) {
  const tournament = await getTournamentByMinId(minId);
  const result = await repo.listTournamentPlayerTables(
    tournament.id,
    query.viewTypeId,
    query.type,
    query.categoryId,
    query.sectionId,
    { limit: query.limit, offset: query.offset }
  );

  return {
    data: result.items,
    meta: {
      limit: query.limit,
      offset: query.offset,
      count: result.total,
    },
  };
}

export async function getTournamentBestXI(
  minId: number,
  query: TournamentBestXIQuery
) {
  const tournament = await getTournamentByMinId(minId);
  const bestXI = await repo.findTournamentBestXI(
    tournament.id,
    query.timeframe,
    query.startDate,
    query.endDate
  );

  if (!bestXI) {
    throw new Error("Best XI not found for the specified criteria");
  }

  return { data: bestXI };
}

// ==================== ALL SERVICES ====================

// GET /all/:minId/complete - Información COMPLETA (equipos + jugadores)
export async function getAllCompleteByMinId(minId: number) {
  // Intentar encontrar por Team primero
  const team = await repo.findTeamByMinId(minId);
  if (team) {
    // Traer TODA la información del team incluyendo jugadores
    const fullData = await repo.getFullTeamData(team.id);
    return {
      data: {
        type: "team",
        ...fullData,
      },
    };
  }

  // Intentar encontrar por Tournament
  const tournament = await repo.findTournamentByMinId(minId);
  if (tournament) {
    // Traer TODA la información del tournament incluyendo jugadores
    const fullData = await repo.getFullTournamentData(tournament.id);
    return {
      data: {
        type: "tournament",
        ...fullData,
      },
    };
  }

  throw new Error("Entity not found with the given minId");
}

// GET /all/:minId/teams-only - Solo información de EQUIPOS (sin jugadores)
export async function getAllTeamsOnlyByMinId(minId: number) {
  // Intentar encontrar por Team primero
  const team = await repo.findTeamByMinId(minId);
  if (team) {
    // Traer TODA la información del team SIN jugadores
    const fullData = await repo.getFullTeamDataWithoutPlayers(team.id);
    return {
      data: {
        type: "team",
        ...fullData,
      },
    };
  }

  // Intentar encontrar por Tournament
  const tournament = await repo.findTournamentByMinId(minId);
  if (tournament) {
    // Traer TODA la información del tournament SIN jugadores
    const fullData = await repo.getFullTournamentDataWithoutPlayers(
      tournament.id
    );
    return {
      data: {
        type: "tournament",
        ...fullData,
      },
    };
  }

  throw new Error("Entity not found with the given minId");
}
