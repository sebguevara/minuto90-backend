import { whoscoredPrismaClient } from "../../../lib/whoscored-client";
import type {
  PaginationQuery,
  TeamPerformanceQuery,
  TeamPositionalQuery,
  TeamSituationalQuery,
  TeamStreaksQuery,
  TopPlayerMetric,
  TournamentTableType,
  TournamentPlayerTableType,
} from "../dtos/stats.dto";

const db = whoscoredPrismaClient;

// ==================== TEAM QUERIES ====================

export async function findTeamByMinId(minId: number) {
  return db.team.findFirst({
    where: { minId },
    include: {
      Country: true,
    },
  });
}

export async function listTeamTournaments(
  teamId: number,
  pagination: PaginationQuery,
  seasonId?: number
) {
  const where = {
    teamId,
    ...(seasonId && { seasonId }),
  };

  const [items, total] = await Promise.all([
    db.teamInTournament.findMany({
      where,
      include: {
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
        Season: true,
        Country: true,
        Team: {
          include: {
            Country: true,
          },
        },
      },
      take: pagination.limit,
      skip: pagination.offset,
      orderBy: { id: "desc" },
    }),
    db.teamInTournament.count({ where }),
  ]);

  return { items, total };
}

export async function listTeamPerformance(
  teamId: number,
  query: TeamPerformanceQuery
) {
  const where = {
    teamId,
    tournamentId: query.tournamentId,
    viewTypeId: query.viewTypeId,
    ...(query.category && { category: query.category }),
    mode: query.mode,
  };

  const [items, total] = await Promise.all([
    db.teamPerformanceStat.findMany({
      where,
      include: {
        Team: {
          include: {
            Country: true,
          },
        },
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
        TableType: true,
      },
      take: query.limit,
      skip: query.offset,
      orderBy: { rank: "asc" },
    }),
    db.teamPerformanceStat.count({ where }),
  ]);

  return { items, total };
}

export async function listTeamPositional(
  teamId: number,
  query: TeamPositionalQuery
) {
  const where = {
    teamId,
    tournamentId: query.tournamentId,
    viewTypeId: query.viewTypeId,
    ...(query.sectionId && { sectionId: query.sectionId }),
  };

  const [items, total] = await Promise.all([
    db.teamPositionalStat.findMany({
      where,
      include: {
        Team: {
          include: {
            Country: true,
          },
        },
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
        TableType: true,
        TableSection: true,
      },
      take: query.limit,
      skip: query.offset,
    }),
    db.teamPositionalStat.count({ where }),
  ]);

  return { items, total };
}

export async function listTeamSituational(
  teamId: number,
  query: TeamSituationalQuery
) {
  const where = {
    teamId,
    tournamentId: query.tournamentId,
    viewTypeId: query.viewTypeId,
    ...(query.sectionId && { sectionId: query.sectionId }),
  };

  const [items, total] = await Promise.all([
    db.teamSituationalStat.findMany({
      where,
      include: {
        Team: {
          include: {
            Country: true,
          },
        },
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
        TableType: true,
        TableSection: true,
      },
      take: query.limit,
      skip: query.offset,
    }),
    db.teamSituationalStat.count({ where }),
  ]);

  return { items, total };
}

export async function listTeamStreaks(
  teamId: number,
  query: TeamStreaksQuery
) {
  const where = {
    teamId,
    tournamentId: query.tournamentId,
    viewTypeId: query.viewTypeId,
    mode: query.mode,
    scope: query.scope,
  };

  const [items, total] = await Promise.all([
    db.teamStreakStat.findMany({
      where,
      include: {
        Team: {
          include: {
            Country: true,
          },
        },
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
        TableType: true,
      },
      take: query.limit,
      skip: query.offset,
      orderBy: { rank: "asc" },
    }),
    db.teamStreakStat.count({ where }),
  ]);

  return { items, total };
}

export async function listTeamTopPlayers(
  teamId: number,
  tournamentId: number,
  viewTypeId: number,
  metric: TopPlayerMetric,
  limit: number
) {
  const includeConfig = {
    Player: {
      include: {
        Country: true,
      },
    },
    Team: {
      include: {
        Country: true,
      },
    },
    Tournament: {
      include: {
        Country: true,
        Region: true,
      },
    },
    TableType: true,
  };

  switch (metric) {
    case "rating":
      return db.topPlayerRating.findMany({
        where: { teamId, tournamentId, viewTypeId },
        include: includeConfig,
        take: limit,
        orderBy: [{ rank: "asc" }, { rating: "desc" }],
      });

    case "assist":
      return db.topPlayerAssist.findMany({
        where: { teamId, tournamentId, viewTypeId },
        include: includeConfig,
        take: limit,
        orderBy: [{ rank: "asc" }, { assists: "desc" }],
      });

    case "shot":
      return db.topPlayerShot.findMany({
        where: { teamId, tournamentId, viewTypeId },
        include: includeConfig,
        take: limit,
        orderBy: [{ rank: "asc" }, { shotsPerGame: "desc" }],
      });

    case "aggression":
      return db.topPlayerAggression.findMany({
        where: { teamId, tournamentId, viewTypeId },
        include: includeConfig,
        take: limit,
        orderBy: [{ rank: "asc" }],
      });

    case "goalContribution":
      return db.topPlayerGoalContribution.findMany({
        where: { teamId, tournamentId, viewTypeId },
        include: includeConfig,
        take: limit,
        orderBy: [{ rank: "asc" }, { contributionPercent: "desc" }],
      });
  }
}

export async function listTeamTables(
  teamId: number,
  tournamentId: number,
  viewTypeId: number
) {
  const where = { teamId, tournamentId };

  const includeConfig = {
    Team: {
      include: {
        Country: true,
      },
    },
    Tournament: {
      include: {
        Country: true,
        Region: true,
      },
    },
    TableType: true,
    TableCategory: true,
    TableSection: true,
  };

  const [defensive, offensive, summary, xg] = await Promise.all([
    db.tableDefensive.findMany({
      where,
      include: includeConfig,
      orderBy: { rank: "asc" },
    }),
    db.tableOffensive.findMany({
      where,
      include: includeConfig,
      orderBy: { rank: "asc" },
    }),
    db.tableSummary.findMany({
      where,
      include: includeConfig,
      orderBy: { rank: "asc" },
    }),
    db.tableXG.findMany({
      where,
      include: includeConfig,
      orderBy: { rank: "asc" },
    }),
  ]);

  return { defensive, offensive, summary, xg };
}

// ==================== FULL TEAM DATA (Para endpoint "all") ====================

export async function getFullTeamData(teamId: number) {
  // Traer absolutamente TODO lo relacionado al team
  const [
    team,
    tournaments,
    performances,
    positionals,
    situationals,
    streaks,
    topPlayersRating,
    topPlayersAssist,
    topPlayersShot,
    topPlayersAggression,
    topPlayersGoalContribution,
    tablesDefensive,
    tablesOffensive,
    tablesSummary,
    tablesXG,
    playerTablesDefensive,
    playerTablesOffensive,
    playerTablesPassing,
    playerTablesSummary,
    playerTablesXG,
    topTeamStats,
    bestXIPlayers,
  ] = await Promise.all([
    // Team base
    db.team.findUnique({
      where: { id: teamId },
      include: {
        Country: true,
      },
    }),

    // Tournaments
    db.teamInTournament.findMany({
      where: { teamId },
      include: {
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
        Season: true,
        Country: true,
      },
    }),

    // Performance stats (todas las categorías, modos, viewTypes)
    db.teamPerformanceStat.findMany({
      where: { teamId },
      include: {
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
        TableType: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Positional stats
    db.teamPositionalStat.findMany({
      where: { teamId },
      include: {
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
        TableType: true,
        TableSection: true,
      },
    }),

    // Situational stats
    db.teamSituationalStat.findMany({
      where: { teamId },
      include: {
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
        TableType: true,
        TableSection: true,
      },
    }),

    // Streak stats
    db.teamStreakStat.findMany({
      where: { teamId },
      include: {
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
        TableType: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Top Players - Rating
    db.topPlayerRating.findMany({
      where: { teamId },
      include: {
        Player: {
          include: {
            Country: true,
          },
        },
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
        TableType: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Top Players - Assists
    db.topPlayerAssist.findMany({
      where: { teamId },
      include: {
        Player: {
          include: {
            Country: true,
          },
        },
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
        TableType: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Top Players - Shots
    db.topPlayerShot.findMany({
      where: { teamId },
      include: {
        Player: {
          include: {
            Country: true,
          },
        },
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
        TableType: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Top Players - Aggression
    db.topPlayerAggression.findMany({
      where: { teamId },
      include: {
        Player: {
          include: {
            Country: true,
          },
        },
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
        TableType: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Top Players - Goal Contribution
    db.topPlayerGoalContribution.findMany({
      where: { teamId },
      include: {
        Player: {
          include: {
            Country: true,
          },
        },
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
        TableType: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Tables - Defensive
    db.tableDefensive.findMany({
      where: { teamId },
      include: {
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
        TableType: true,
        TableCategory: true,
        TableSection: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Tables - Offensive
    db.tableOffensive.findMany({
      where: { teamId },
      include: {
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
        TableType: true,
        TableCategory: true,
        TableSection: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Tables - Summary
    db.tableSummary.findMany({
      where: { teamId },
      include: {
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
        TableType: true,
        TableCategory: true,
        TableSection: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Tables - XG
    db.tableXG.findMany({
      where: { teamId },
      include: {
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
        TableType: true,
        TableCategory: true,
        TableSection: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Player Tables - Defensive
    db.playerTableDefensive.findMany({
      where: { teamId },
      include: {
        Player: {
          include: {
            Country: true,
          },
        },
        TableType: true,
        TableCategory: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Player Tables - Offensive
    db.playerTableOffensive.findMany({
      where: { teamId },
      include: {
        Player: {
          include: {
            Country: true,
          },
        },
        TableType: true,
        TableCategory: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Player Tables - Passing
    db.playerTablePassing.findMany({
      where: { teamId },
      include: {
        Player: {
          include: {
            Country: true,
          },
        },
        TableType: true,
        TableCategory: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Player Tables - Summary
    db.playerTableSummary.findMany({
      where: { teamId },
      include: {
        Player: {
          include: {
            Country: true,
          },
        },
        TableType: true,
        TableCategory: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Player Tables - XG
    db.playerTableXG.findMany({
      where: { teamId },
      include: {
        Player: {
          include: {
            Country: true,
          },
        },
        TableType: true,
        TableCategory: true,
        TableSection: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Top Team Stats
    db.topTeamStat.findMany({
      where: { teamId },
      include: {
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
        TableType: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Best XI Players
    db.bestXIPlayer.findMany({
      where: { teamId },
      include: {
        BestXI: {
          include: {
            Tournament: {
              include: {
                Country: true,
                Region: true,
              },
            },
          },
        },
        Player: {
          include: {
            Country: true,
          },
        },
      },
      orderBy: { positionIndex: "asc" },
    }),
  ]);

  return {
    team,
    tournaments,
    performance: {
      all: performances,
    },
    positional: {
      all: positionals,
    },
    situational: {
      all: situationals,
    },
    streaks: {
      all: streaks,
    },
    topPlayers: {
      rating: topPlayersRating,
      assist: topPlayersAssist,
      shot: topPlayersShot,
      aggression: topPlayersAggression,
      goalContribution: topPlayersGoalContribution,
    },
    tables: {
      defensive: tablesDefensive,
      offensive: tablesOffensive,
      summary: tablesSummary,
      xg: tablesXG,
    },
    playerTables: {
      defensive: playerTablesDefensive,
      offensive: playerTablesOffensive,
      passing: playerTablesPassing,
      summary: playerTablesSummary,
      xg: playerTablesXG,
    },
    topTeamStats: topTeamStats,
    bestXIAppearances: bestXIPlayers,
  };
}

// ==================== TOURNAMENT QUERIES ====================

export async function findTournamentByMinId(minId: number) {
  return db.tournament.findFirst({
    where: { minId },
    include: {
      Country: true,
      Region: true,
    },
  });
}

export async function listTournamentTeams(
  tournamentId: number,
  pagination: PaginationQuery,
  seasonId?: number
) {
  const where = {
    tournamentId,
    ...(seasonId && { seasonId }),
  };

  const [items, total] = await Promise.all([
    db.teamInTournament.findMany({
      where,
      include: {
        Team: {
          include: {
            Country: true,
          },
        },
        Country: true,
        Season: true,
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
      },
      take: pagination.limit,
      skip: pagination.offset,
      orderBy: { id: "desc" },
    }),
    db.teamInTournament.count({ where }),
  ]);

  return { items, total };
}

export async function listTournamentTables(
  tournamentId: number,
  viewTypeId: number,
  type: TournamentTableType | undefined,
  categoryId: number | undefined,
  sectionId: number | undefined,
  pagination: PaginationQuery
) {
  const baseWhere = {
    tournamentId,
    viewTypeId,
    ...(categoryId && { categoryId }),
    ...(sectionId && { sectionId }),
  };

  const includeConfig = {
    Team: {
      include: {
        Country: true,
      },
    },
    Tournament: {
      include: {
        Country: true,
        Region: true,
      },
    },
    TableCategory: true,
    TableSection: true,
    TableType_TournamentTableDefensive_typeIdToTableType: true,
    TableType_TournamentTableDefensive_viewTypeIdToTableType: true,
  };

  if (type === "defensive") {
    const [items, total] = await Promise.all([
      db.tournamentTableDefensive.findMany({
        where: baseWhere,
        include: includeConfig,
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
          ...includeConfig,
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
          ...includeConfig,
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
          ...includeConfig,
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

  // Default: return all types
  const [defensive, offensive, summary, xg] = await Promise.all([
    db.tournamentTableDefensive.findMany({
      where: baseWhere,
      include: includeConfig,
      take: pagination.limit,
      skip: pagination.offset,
      orderBy: { rank: "asc" },
    }),
    db.tournamentTableOffensive.findMany({
      where: baseWhere,
      include: {
        ...includeConfig,
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
        ...includeConfig,
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
        ...includeConfig,
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

export async function listTournamentPlayerTables(
  tournamentId: number,
  viewTypeId: number,
  type: TournamentPlayerTableType | undefined,
  categoryId: number | undefined,
  sectionId: number | undefined,
  pagination: PaginationQuery
) {
  const baseWhere = {
    tournamentId,
    viewTypeId,
    ...(categoryId && { categoryId }),
    ...(sectionId && { sectionId }),
  };

  const includeConfig = {
    Player: {
      include: {
        Country: true,
      },
    },
    Team: {
      include: {
        Country: true,
      },
    },
    Tournament: {
      include: {
        Country: true,
        Region: true,
      },
    },
    TableCategory: true,
    TableSection: true,
  };

  if (type === "defensive") {
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

  // Default: return summary
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

export async function findTournamentBestXI(
  tournamentId: number,
  timeframe: string,
  startDate: string,
  endDate: string
) {
  return db.bestXI.findFirst({
    where: {
      tournamentId,
      timeframe,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    },
    include: {
      Tournament: {
        include: {
          Country: true,
          Region: true,
        },
      },
      BestXIPlayer: {
        include: {
          Team: {
            include: {
              Country: true,
            },
          },
          Player: {
            include: {
              Country: true,
            },
          },
        },
        orderBy: { positionIndex: "asc" },
      },
    },
  });
}

// ==================== FULL TOURNAMENT DATA (Para endpoint "all") ====================

export async function getFullTournamentData(tournamentId: number) {
  // Traer absolutamente TODO lo relacionado al tournament
  const [
    tournament,
    teams,
    teamPerformanceStats,
    teamPositionalStats,
    teamSituationalStats,
    teamStreakStats,
    topPlayersRating,
    topPlayersAssist,
    topPlayersShot,
    topPlayersAggression,
    topPlayersGoalContribution,
    tournamentTablesDefensive,
    tournamentTablesOffensive,
    tournamentTablesSummary,
    tournamentTablesXG,
    tournamentPlayerTablesDefensive,
    tournamentPlayerTablesOffensive,
    tournamentPlayerTablesPassing,
    tournamentPlayerTablesSummary,
    tournamentPlayerTablesXG,
    topTeamStats,
    bestXIs,
    assistToGoal,
  ] = await Promise.all([
    // Tournament base
    db.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        Country: true,
        Region: true,
      },
    }),

    // Teams in tournament
    db.teamInTournament.findMany({
      where: { tournamentId },
      include: {
        Team: {
          include: {
            Country: true,
          },
        },
        Country: true,
        Season: true,
      },
    }),

    // Team Performance Stats
    db.teamPerformanceStat.findMany({
      where: { tournamentId },
      include: {
        Team: {
          include: {
            Country: true,
          },
        },
        TableType: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Team Positional Stats
    db.teamPositionalStat.findMany({
      where: { tournamentId },
      include: {
        Team: {
          include: {
            Country: true,
          },
        },
        TableType: true,
        TableSection: true,
      },
    }),

    // Team Situational Stats
    db.teamSituationalStat.findMany({
      where: { tournamentId },
      include: {
        Team: {
          include: {
            Country: true,
          },
        },
        TableType: true,
        TableSection: true,
      },
    }),

    // Team Streak Stats
    db.teamStreakStat.findMany({
      where: { tournamentId },
      include: {
        Team: {
          include: {
            Country: true,
          },
        },
        TableType: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Top Players Rating
    db.topPlayerRating.findMany({
      where: { tournamentId },
      include: {
        Player: {
          include: {
            Country: true,
          },
        },
        Team: {
          include: {
            Country: true,
          },
        },
        TableType: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Top Players Assist
    db.topPlayerAssist.findMany({
      where: { tournamentId },
      include: {
        Player: {
          include: {
            Country: true,
          },
        },
        Team: {
          include: {
            Country: true,
          },
        },
        TableType: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Top Players Shot
    db.topPlayerShot.findMany({
      where: { tournamentId },
      include: {
        Player: {
          include: {
            Country: true,
          },
        },
        Team: {
          include: {
            Country: true,
          },
        },
        TableType: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Top Players Aggression
    db.topPlayerAggression.findMany({
      where: { tournamentId },
      include: {
        Player: {
          include: {
            Country: true,
          },
        },
        Team: {
          include: {
            Country: true,
          },
        },
        TableType: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Top Players Goal Contribution
    db.topPlayerGoalContribution.findMany({
      where: { tournamentId },
      include: {
        Player: {
          include: {
            Country: true,
          },
        },
        Team: {
          include: {
            Country: true,
          },
        },
        TableType: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Tournament Tables Defensive
    db.tournamentTableDefensive.findMany({
      where: { tournamentId },
      include: {
        Team: {
          include: {
            Country: true,
          },
        },
        TableCategory: true,
        TableSection: true,
        TableType_TournamentTableDefensive_typeIdToTableType: true,
        TableType_TournamentTableDefensive_viewTypeIdToTableType: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Tournament Tables Offensive
    db.tournamentTableOffensive.findMany({
      where: { tournamentId },
      include: {
        Team: {
          include: {
            Country: true,
          },
        },
        TableCategory: true,
        TableSection: true,
        TableType_TournamentTableOffensive_typeIdToTableType: true,
        TableType_TournamentTableOffensive_viewTypeIdToTableType: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Tournament Tables Summary
    db.tournamentTableSummary.findMany({
      where: { tournamentId },
      include: {
        Team: {
          include: {
            Country: true,
          },
        },
        TableCategory: true,
        TableSection: true,
        TableType_TournamentTableSummary_typeIdToTableType: true,
        TableType_TournamentTableSummary_viewTypeIdToTableType: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Tournament Tables XG
    db.tournamentTableXG.findMany({
      where: { tournamentId },
      include: {
        Team: {
          include: {
            Country: true,
          },
        },
        TableCategory: true,
        TableSection: true,
        TableType_TournamentTableXG_typeIdToTableType: true,
        TableType_TournamentTableXG_viewTypeIdToTableType: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Tournament Player Tables Defensive
    db.tournamentPlayerTableDefensive.findMany({
      where: { tournamentId },
      include: {
        Player: {
          include: {
            Country: true,
          },
        },
        Team: {
          include: {
            Country: true,
          },
        },
        TableCategory: true,
        TableSection: true,
        TableType_TournamentPlayerTableDefensive_typeIdToTableType: true,
        TableType_TournamentPlayerTableDefensive_viewTypeIdToTableType: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Tournament Player Tables Offensive
    db.tournamentPlayerTableOffensive.findMany({
      where: { tournamentId },
      include: {
        Player: {
          include: {
            Country: true,
          },
        },
        Team: {
          include: {
            Country: true,
          },
        },
        TableCategory: true,
        TableSection: true,
        TableType_TournamentPlayerTableOffensive_typeIdToTableType: true,
        TableType_TournamentPlayerTableOffensive_viewTypeIdToTableType: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Tournament Player Tables Passing
    db.tournamentPlayerTablePassing.findMany({
      where: { tournamentId },
      include: {
        Player: {
          include: {
            Country: true,
          },
        },
        Team: {
          include: {
            Country: true,
          },
        },
        TableCategory: true,
        TableSection: true,
        TableType_TournamentPlayerTablePassing_typeIdToTableType: true,
        TableType_TournamentPlayerTablePassing_viewTypeIdToTableType: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Tournament Player Tables Summary
    db.tournamentPlayerTableSummary.findMany({
      where: { tournamentId },
      include: {
        Player: {
          include: {
            Country: true,
          },
        },
        Team: {
          include: {
            Country: true,
          },
        },
        TableCategory: true,
        TableSection: true,
        TableType_TournamentPlayerTableSummary_typeIdToTableType: true,
        TableType_TournamentPlayerTableSummary_viewTypeIdToTableType: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Tournament Player Tables XG
    db.tournamentPlayerTableXG.findMany({
      where: { tournamentId },
      include: {
        Player: {
          include: {
            Country: true,
          },
        },
        Team: {
          include: {
            Country: true,
          },
        },
        TableCategory: true,
        TableSection: true,
        TableType_TournamentPlayerTableXG_typeIdToTableType: true,
        TableType_TournamentPlayerTableXG_viewTypeIdToTableType: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Top Team Stats
    db.topTeamStat.findMany({
      where: { tournamentId },
      include: {
        Team: {
          include: {
            Country: true,
          },
        },
        TableType: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Best XIs
    db.bestXI.findMany({
      where: { tournamentId },
      include: {
        BestXIPlayer: {
          include: {
            Team: {
              include: {
                Country: true,
              },
            },
            Player: {
              include: {
                Country: true,
              },
            },
          },
          orderBy: { positionIndex: "asc" },
        },
      },
    }),

    // Assist to Goal connections
    db.tournamentAssistToGoal.findMany({
      where: { tournamentId },
      include: {
        Team: {
          include: {
            Country: true,
          },
        },
        Player_TournamentAssistToGoal_assistantIdToPlayer: {
          include: {
            Country: true,
          },
        },
        Player_TournamentAssistToGoal_scorerIdToPlayer: {
          include: {
            Country: true,
          },
        },
        TableType: true,
      },
      orderBy: { rank: "asc" },
    }),
  ]);

  return {
    tournament,
    teams,
    teamStats: {
      performance: teamPerformanceStats,
      positional: teamPositionalStats,
      situational: teamSituationalStats,
      streaks: teamStreakStats,
    },
    topPlayers: {
      rating: topPlayersRating,
      assist: topPlayersAssist,
      shot: topPlayersShot,
      aggression: topPlayersAggression,
      goalContribution: topPlayersGoalContribution,
    },
    tournamentTables: {
      defensive: tournamentTablesDefensive,
      offensive: tournamentTablesOffensive,
      summary: tournamentTablesSummary,
      xg: tournamentTablesXG,
    },
    playerTables: {
      defensive: tournamentPlayerTablesDefensive,
      offensive: tournamentPlayerTablesOffensive,
      passing: tournamentPlayerTablesPassing,
      summary: tournamentPlayerTablesSummary,
      xg: tournamentPlayerTablesXG,
    },
    topTeamStats,
    bestXIs,
    assistToGoal,
  };
}

// ==================== FULL TEAM DATA WITHOUT PLAYERS (Solo equipos) ====================

export async function getFullTeamDataWithoutPlayers(teamId: number) {
  // Traer TODO relacionado al team EXCEPTO información de jugadores
  const [
    team,
    tournaments,
    performances,
    positionals,
    situationals,
    streaks,
    tablesDefensive,
    tablesOffensive,
    tablesSummary,
    tablesXG,
    topTeamStats,
  ] = await Promise.all([
    // Team base
    db.team.findUnique({
      where: { id: teamId },
      include: {
        Country: true,
      },
    }),

    // Tournaments
    db.teamInTournament.findMany({
      where: { teamId },
      include: {
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
        Season: true,
        Country: true,
      },
    }),

    // Performance stats (todas las categorías, modos, viewTypes)
    db.teamPerformanceStat.findMany({
      where: { teamId },
      include: {
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
        TableType: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Positional stats
    db.teamPositionalStat.findMany({
      where: { teamId },
      include: {
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
        TableType: true,
        TableSection: true,
      },
    }),

    // Situational stats
    db.teamSituationalStat.findMany({
      where: { teamId },
      include: {
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
        TableType: true,
        TableSection: true,
      },
    }),

    // Streak stats
    db.teamStreakStat.findMany({
      where: { teamId },
      include: {
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
        TableType: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Tables - Defensive
    db.tableDefensive.findMany({
      where: { teamId },
      include: {
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
        TableType: true,
        TableCategory: true,
        TableSection: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Tables - Offensive
    db.tableOffensive.findMany({
      where: { teamId },
      include: {
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
        TableType: true,
        TableCategory: true,
        TableSection: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Tables - Summary
    db.tableSummary.findMany({
      where: { teamId },
      include: {
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
        TableType: true,
        TableCategory: true,
        TableSection: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Tables - XG
    db.tableXG.findMany({
      where: { teamId },
      include: {
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
        TableType: true,
        TableCategory: true,
        TableSection: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Top Team Stats
    db.topTeamStat.findMany({
      where: { teamId },
      include: {
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
        TableType: true,
      },
      orderBy: { rank: "asc" },
    }),
  ]);

  return {
    team,
    tournaments,
    performance: {
      all: performances,
    },
    positional: {
      all: positionals,
    },
    situational: {
      all: situationals,
    },
    streaks: {
      all: streaks,
    },
    tables: {
      defensive: tablesDefensive,
      offensive: tablesOffensive,
      summary: tablesSummary,
      xg: tablesXG,
    },
    topTeamStats: topTeamStats,
  };
}

// ==================== FULL TOURNAMENT DATA WITHOUT PLAYERS (Solo equipos) ====================

export async function getFullTournamentDataWithoutPlayers(
  tournamentId: number
) {
  // Traer TODO relacionado al tournament EXCEPTO información de jugadores
  const [
    tournament,
    teams,
    teamPerformanceStats,
    teamPositionalStats,
    teamSituationalStats,
    teamStreakStats,
    tournamentTablesDefensive,
    tournamentTablesOffensive,
    tournamentTablesSummary,
    tournamentTablesXG,
    topTeamStats,
    assistToGoal,
  ] = await Promise.all([
    // Tournament base
    db.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        Country: true,
        Region: true,
      },
    }),

    // Teams in tournament
    db.teamInTournament.findMany({
      where: { tournamentId },
      include: {
        Team: {
          include: {
            Country: true,
          },
        },
        Country: true,
        Season: true,
      },
    }),

    // Team Performance Stats
    db.teamPerformanceStat.findMany({
      where: { tournamentId },
      include: {
        Team: {
          include: {
            Country: true,
          },
        },
        TableType: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Team Positional Stats
    db.teamPositionalStat.findMany({
      where: { tournamentId },
      include: {
        Team: {
          include: {
            Country: true,
          },
        },
        TableType: true,
        TableSection: true,
      },
    }),

    // Team Situational Stats
    db.teamSituationalStat.findMany({
      where: { tournamentId },
      include: {
        Team: {
          include: {
            Country: true,
          },
        },
        TableType: true,
        TableSection: true,
      },
    }),

    // Team Streak Stats
    db.teamStreakStat.findMany({
      where: { tournamentId },
      include: {
        Team: {
          include: {
            Country: true,
          },
        },
        TableType: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Tournament Tables Defensive
    db.tournamentTableDefensive.findMany({
      where: { tournamentId },
      include: {
        Team: {
          include: {
            Country: true,
          },
        },
        TableCategory: true,
        TableSection: true,
        TableType_TournamentTableDefensive_typeIdToTableType: true,
        TableType_TournamentTableDefensive_viewTypeIdToTableType: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Tournament Tables Offensive
    db.tournamentTableOffensive.findMany({
      where: { tournamentId },
      include: {
        Team: {
          include: {
            Country: true,
          },
        },
        TableCategory: true,
        TableSection: true,
        TableType_TournamentTableOffensive_typeIdToTableType: true,
        TableType_TournamentTableOffensive_viewTypeIdToTableType: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Tournament Tables Summary
    db.tournamentTableSummary.findMany({
      where: { tournamentId },
      include: {
        Team: {
          include: {
            Country: true,
          },
        },
        TableCategory: true,
        TableSection: true,
        TableType_TournamentTableSummary_typeIdToTableType: true,
        TableType_TournamentTableSummary_viewTypeIdToTableType: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Tournament Tables XG
    db.tournamentTableXG.findMany({
      where: { tournamentId },
      include: {
        Team: {
          include: {
            Country: true,
          },
        },
        TableCategory: true,
        TableSection: true,
        TableType_TournamentTableXG_typeIdToTableType: true,
        TableType_TournamentTableXG_viewTypeIdToTableType: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Top Team Stats
    db.topTeamStat.findMany({
      where: { tournamentId },
      include: {
        Team: {
          include: {
            Country: true,
          },
        },
        TableType: true,
      },
      orderBy: { rank: "asc" },
    }),

    // Assist to Goal connections (mantener porque es sobre conexiones del equipo)
    db.tournamentAssistToGoal.findMany({
      where: { tournamentId },
      include: {
        Team: {
          include: {
            Country: true,
          },
        },
        Player_TournamentAssistToGoal_assistantIdToPlayer: {
          include: {
            Country: true,
          },
        },
        Player_TournamentAssistToGoal_scorerIdToPlayer: {
          include: {
            Country: true,
          },
        },
        TableType: true,
      },
      orderBy: { rank: "asc" },
    }),
  ]);

  return {
    tournament,
    teams,
    teamStats: {
      performance: teamPerformanceStats,
      positional: teamPositionalStats,
      situational: teamSituationalStats,
      streaks: teamStreakStats,
    },
    tournamentTables: {
      defensive: tournamentTablesDefensive,
      offensive: tournamentTablesOffensive,
      summary: tournamentTablesSummary,
      xg: tournamentTablesXG,
    },
    topTeamStats,
    assistToGoal,
  };
}
