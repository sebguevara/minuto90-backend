import { whoscoredPrismaClient } from "../../../lib/whoscored-client";
import type { PaginationOptions } from "../dtos/stats.dto";

const db = whoscoredPrismaClient;

// ==================== ESTADÍSTICAS DE EQUIPOS ====================

export async function fetchTeamSummaryStats(
  tournamentId: number,
  viewTypeId: number,
  categoryId?: number,
  sectionId?: number,
  pagination?: PaginationOptions
) {
  const where: any = {
    tournamentId,
    viewTypeId,
  };

  if (categoryId !== undefined) {
    where.categoryId = categoryId;
  }
  if (sectionId !== undefined) {
    where.sectionId = sectionId;
  }

  const [items, total] = await Promise.all([
    db.tournamentTableSummary.findMany({
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
        TableType_TournamentTableSummary_viewTypeIdToTableType: true,
        TableCategory: true,
        TableSection: true,
      },
      take: pagination?.limit || 20,
      skip: pagination?.offset || 0,
      orderBy: { rank: "asc" },
    }),
    db.tournamentTableSummary.count({ where }),
  ]);

  return { items, total };
}

export async function fetchTeamDefensiveStats(
  tournamentId: number,
  viewTypeId: number,
  categoryId?: number,
  sectionId?: number,
  pagination?: PaginationOptions
) {
  const where: any = {
    tournamentId,
    viewTypeId,
  };

  if (categoryId !== undefined) {
    where.categoryId = categoryId;
  }
  if (sectionId !== undefined) {
    where.sectionId = sectionId;
  }

  const [items, total] = await Promise.all([
    db.tournamentTableDefensive.findMany({
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
        TableType_TournamentTableDefensive_viewTypeIdToTableType: true,
        TableCategory: true,
        TableSection: true,
      },
      take: pagination?.limit || 20,
      skip: pagination?.offset || 0,
      orderBy: { rank: "asc" },
    }),
    db.tournamentTableDefensive.count({ where }),
  ]);

  return { items, total };
}

export async function fetchTeamOffensiveStats(
  tournamentId: number,
  viewTypeId: number,
  categoryId?: number,
  sectionId?: number,
  pagination?: PaginationOptions
) {
  const where: any = {
    tournamentId,
    viewTypeId,
  };

  if (categoryId !== undefined) {
    where.categoryId = categoryId;
  }
  if (sectionId !== undefined) {
    where.sectionId = sectionId;
  }

  const [items, total] = await Promise.all([
    db.tournamentTableOffensive.findMany({
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
        TableType_TournamentTableOffensive_viewTypeIdToTableType: true,
        TableCategory: true,
        TableSection: true,
      },
      take: pagination?.limit || 20,
      skip: pagination?.offset || 0,
      orderBy: { rank: "asc" },
    }),
    db.tournamentTableOffensive.count({ where }),
  ]);

  return { items, total };
}

export async function fetchTeamXGStats(
  tournamentId: number,
  viewTypeId: number,
  categoryId?: number,
  sectionId?: number,
  pagination?: PaginationOptions
) {
  const where: any = {
    tournamentId,
    viewTypeId,
  };

  if (categoryId !== undefined) {
    where.categoryId = categoryId;
  }
  if (sectionId !== undefined) {
    where.sectionId = sectionId;
  }

  const [items, total] = await Promise.all([
    db.tournamentTableXG.findMany({
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
        TableType_TournamentTableXG_viewTypeIdToTableType: true,
        TableCategory: true,
        TableSection: true,
      },
      take: pagination?.limit || 20,
      skip: pagination?.offset || 0,
      orderBy: { rank: "asc" },
    }),
    db.tournamentTableXG.count({ where }),
  ]);

  return { items, total };
}

// ==================== ESTADÍSTICAS DE JUGADORES ====================

export async function fetchPlayerSummaryStats(
  tournamentId: number,
  viewTypeId: number,
  categoryId?: number,
  sectionId?: number,
  pagination?: PaginationOptions
) {
  const where: any = {
    tournamentId,
    viewTypeId,
  };

  if (categoryId !== undefined) {
    where.categoryId = categoryId;
  }
  if (sectionId !== undefined) {
    where.sectionId = sectionId;
  }

  const [items, total] = await Promise.all([
    db.tournamentPlayerTableSummary.findMany({
      where,
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
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
        TableType_TournamentPlayerTableSummary_viewTypeIdToTableType: true,
        TableCategory: true,
        TableSection: true,
      },
      take: pagination?.limit || 20,
      skip: pagination?.offset || 0,
      orderBy: { rank: "asc" },
    }),
    db.tournamentPlayerTableSummary.count({ where }),
  ]);

  return { items, total };
}

export async function fetchPlayerDefensiveStats(
  tournamentId: number,
  viewTypeId: number,
  categoryId?: number,
  sectionId?: number,
  pagination?: PaginationOptions
) {
  const where: any = {
    tournamentId,
    viewTypeId,
  };

  if (categoryId !== undefined) {
    where.categoryId = categoryId;
  }
  if (sectionId !== undefined) {
    where.sectionId = sectionId;
  }

  const [items, total] = await Promise.all([
    db.tournamentPlayerTableDefensive.findMany({
      where,
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
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
        TableType_TournamentPlayerTableDefensive_viewTypeIdToTableType: true,
        TableCategory: true,
        TableSection: true,
      },
      take: pagination?.limit || 20,
      skip: pagination?.offset || 0,
      orderBy: { rank: "asc" },
    }),
    db.tournamentPlayerTableDefensive.count({ where }),
  ]);

  return { items, total };
}

export async function fetchPlayerOffensiveStats(
  tournamentId: number,
  viewTypeId: number,
  categoryId?: number,
  sectionId?: number,
  pagination?: PaginationOptions
) {
  const where: any = {
    tournamentId,
    viewTypeId,
  };

  if (categoryId !== undefined) {
    where.categoryId = categoryId;
  }
  if (sectionId !== undefined) {
    where.sectionId = sectionId;
  }

  const [items, total] = await Promise.all([
    db.tournamentPlayerTableOffensive.findMany({
      where,
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
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
        TableType_TournamentPlayerTableOffensive_viewTypeIdToTableType: true,
        TableCategory: true,
        TableSection: true,
      },
      take: pagination?.limit || 20,
      skip: pagination?.offset || 0,
      orderBy: { rank: "asc" },
    }),
    db.tournamentPlayerTableOffensive.count({ where }),
  ]);

  return { items, total };
}

export async function fetchPlayerPassingStats(
  tournamentId: number,
  viewTypeId: number,
  categoryId?: number,
  sectionId?: number,
  pagination?: PaginationOptions
) {
  const where: any = {
    tournamentId,
    viewTypeId,
  };

  if (categoryId !== undefined) {
    where.categoryId = categoryId;
  }
  if (sectionId !== undefined) {
    where.sectionId = sectionId;
  }

  const [items, total] = await Promise.all([
    db.tournamentPlayerTablePassing.findMany({
      where,
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
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
        TableType_TournamentPlayerTablePassing_viewTypeIdToTableType: true,
        TableCategory: true,
        TableSection: true,
      },
      take: pagination?.limit || 20,
      skip: pagination?.offset || 0,
      orderBy: { rank: "asc" },
    }),
    db.tournamentPlayerTablePassing.count({ where }),
  ]);

  return { items, total };
}

export async function fetchPlayerXGStats(
  tournamentId: number,
  viewTypeId: number,
  categoryId?: number,
  sectionId?: number,
  pagination?: PaginationOptions
) {
  const where: any = {
    tournamentId,
    viewTypeId,
  };

  if (categoryId !== undefined) {
    where.categoryId = categoryId;
  }
  if (sectionId !== undefined) {
    where.sectionId = sectionId;
  }

  const [items, total] = await Promise.all([
    db.tournamentPlayerTableXG.findMany({
      where,
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
        Tournament: {
          include: {
            Country: true,
            Region: true,
          },
        },
        TableType_TournamentPlayerTableXG_viewTypeIdToTableType: true,
        TableCategory: true,
        TableSection: true,
      },
      take: pagination?.limit || 20,
      skip: pagination?.offset || 0,
      orderBy: { rank: "asc" },
    }),
    db.tournamentPlayerTableXG.count({ where }),
  ]);

  return { items, total };
}

// ==================== RACHAS ====================

export async function fetchTeamStreaks(
  tournamentId: number,
  viewTypeId: number,
  mode: string = "all",
  scope: string = "Current",
  pagination?: PaginationOptions
) {
  const where = {
    tournamentId,
    viewTypeId,
    mode,
    scope,
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
      take: pagination?.limit || 20,
      skip: pagination?.offset || 0,
      orderBy: [{ rank: "asc" }],
    }),
    db.teamStreakStat.count({ where }),
  ]);

  return { items, total };
}

// ==================== RENDIMIENTOS ====================

export async function fetchTeamPerformance(
  tournamentId: number,
  viewTypeId: number,
  mode: string = "all",
  pagination?: PaginationOptions
) {
  const where = {
    tournamentId,
    viewTypeId,
    mode,
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
      take: pagination?.limit || 20,
      skip: pagination?.offset || 0,
      orderBy: { rank: "asc" },
    }),
    db.teamPerformanceStat.count({ where }),
  ]);

  return { items, total };
}

// ==================== XI IDEAL ====================

export async function fetchBestXI(
  tournamentId: number,
  timeframe: string = "season",
  startDate?: Date,
  endDate?: Date
) {
  const where: any = {
    tournamentId,
    timeframe,
  };

  // Si se proporcionan fechas específicas
  if (startDate) {
    where.startDate = startDate;
  }
  if (endDate) {
    where.endDate = endDate;
  }

  return db.bestXI.findFirst({
    where,
    include: {
      Tournament: {
        include: {
          Country: true,
          Region: true,
        },
      },
      BestXIPlayer: {
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
        },
        orderBy: {
          positionIndex: "asc",
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

// ==================== TOP PLAYERS ====================

export async function fetchTopPlayersByRating(
  tournamentId: number,
  viewTypeId: number,
  limit: number = 10
) {
  return db.topPlayerRating.findMany({
    where: {
      tournamentId,
      viewTypeId,
    },
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
      Tournament: {
        include: {
          Country: true,
          Region: true,
        },
      },
      TableType: true,
    },
    take: limit,
    orderBy: {
      rank: "asc",
    },
  });
}

export async function fetchTopPlayersByAssists(
  tournamentId: number,
  viewTypeId: number,
  limit: number = 10
) {
  return db.topPlayerAssist.findMany({
    where: {
      tournamentId,
      viewTypeId,
    },
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
      Tournament: {
        include: {
          Country: true,
          Region: true,
        },
      },
      TableType: true,
    },
    take: limit,
    orderBy: {
      rank: "asc",
    },
  });
}

export async function fetchTopPlayersByShots(
  tournamentId: number,
  viewTypeId: number,
  limit: number = 10
) {
  return db.topPlayerShot.findMany({
    where: {
      tournamentId,
      viewTypeId,
    },
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
      Tournament: {
        include: {
          Country: true,
          Region: true,
        },
      },
      TableType: true,
    },
    take: limit,
    orderBy: {
      rank: "asc",
    },
  });
}

export async function fetchTopPlayersByAggression(
  tournamentId: number,
  viewTypeId: number,
  limit: number = 10
) {
  return db.topPlayerAggression.findMany({
    where: {
      tournamentId,
      viewTypeId,
    },
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
      Tournament: {
        include: {
          Country: true,
          Region: true,
        },
      },
      TableType: true,
    },
    take: limit,
    orderBy: {
      rank: "asc",
    },
  });
}

export async function fetchTopPlayersByGoalContribution(
  tournamentId: number,
  viewTypeId: number,
  limit: number = 10
) {
  return db.topPlayerGoalContribution.findMany({
    where: {
      tournamentId,
      viewTypeId,
    },
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
      Tournament: {
        include: {
          Country: true,
          Region: true,
        },
      },
      TableType: true,
    },
    take: limit,
    orderBy: {
      rank: "asc",
    },
  });
}
