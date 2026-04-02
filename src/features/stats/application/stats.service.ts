import * as repo from "../infrastructure/stats.repo";
import { groupTeamTopStats } from "./matchProfile.group";
import { getFootballTeamsAll } from "../infrastructure/football-teams-all.store";
import { redisFootballCacheStore } from "../../sports/infrastructure/football-cache.store";
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

const MATCH_PROFILE_TTL_SECONDS = 60 * 60 * 4; // 4 hours
function matchProfileCacheKey(teamId: number) {
  return `minuto90:match-profile:team:${teamId}:v1`;
}

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
    query.typeId,
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
    query.typeId,
    query.minApps,
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

/**
 * Enriches tournament teams data with logo URLs from football:teams:all Redis store.
 * Teams in the DB have no logo field; logos come from the football API cache.
 */
async function enrichTournamentTeamsWithLogos<T extends { teams?: any[] }>(
  fullData: T
): Promise<T> {
  if (!fullData.teams?.length) return fullData;

  const footballTeams = await getFootballTeamsAll();
  if (!footballTeams?.length) return fullData;

  const minIdToLogo = new Map<number, string>();
  for (const t of footballTeams) {
    if (t.id && t.logo) minIdToLogo.set(t.id, t.logo);
  }

  return {
    ...fullData,
    teams: fullData.teams.map((tit: any) => {
      const minId: number | null = tit.Team?.minId ?? null;
      const logo = minId != null ? (minIdToLogo.get(minId) ?? null) : null;
      return {
        ...tit,
        Team: tit.Team ? { ...tit.Team, logo } : tit.Team,
      };
    }),
  };
}

// GET /all/:minId/complete - Información COMPLETA (equipos + jugadores)
export async function getAllCompleteByMinId(
  minId: number,
  opts?: { playerTables?: "global" | "tournament", entityType?: "team" | "tournament" }
) {
  // Buscar Team y Tournament en paralelo según entityType
  const [team, tournament] = await Promise.all([
    opts?.entityType === "tournament" ? Promise.resolve(null) : repo.findTeamByMinId(minId),

    opts?.entityType === "team" ? Promise.resolve(null) : repo.findTournamentByMinId(minId),
  ]);

  const teamExact = team?.minId === minId;
  const tournamentExact = tournament?.minId === minId;

  if (tournament && tournamentExact) {
    const rawData = await repo.getFullTournamentData(tournament.id, opts);
    const fullData = await enrichTournamentTeamsWithLogos(rawData);
    return { data: { type: "tournament", ...fullData } };
  }
  if (team && teamExact) {
    const fullData = await repo.getFullTeamData(team.id);
    return { data: { type: "team", ...fullData } };
  }

  // Solo fallback por id — tournament tiene prioridad
  if (tournament) {
    const rawData = await repo.getFullTournamentData(tournament.id, opts);
    const fullData = await enrichTournamentTeamsWithLogos(rawData);
    return { data: { type: "tournament", ...fullData } };
  }
  if (team) {
    const fullData = await repo.getFullTeamData(team.id);
    return { data: { type: "team", ...fullData } };
  }

  throw new Error("Entity not found with the given minId");
}

// ==================== MATCH PROFILE ====================

// GET /match-profile/:minId - Perfil completo del equipo para vista de partido
export async function getTeamMatchProfile(minId: number) {
  const team = await getTeamByMinId(minId);
  const cacheKey = matchProfileCacheKey(team.id);

  const cached = await redisFootballCacheStore.get<ReturnType<typeof buildMatchProfileResponse>>(cacheKey);
  if (cached) return cached;

  const profile = await repo.fetchMatchProfile(team.id);
  const response = buildMatchProfileResponse(profile);

  await redisFootballCacheStore.set(cacheKey, response, MATCH_PROFILE_TTL_SECONDS);

  return response;
}

function buildMatchProfileResponse(profile: Awaited<ReturnType<typeof repo.fetchMatchProfile>>) {
  return {
    data: {
      ...profile,
      topStatsGrouped: groupTeamTopStats(profile.topStats),
    },
  };
}

// GET /all/:minId/teams-only - Solo información de EQUIPOS (sin jugadores)
export async function getAllTeamsOnlyByMinId(
  minId: number,
  opts?: { entityType?: "team" | "tournament" }
) {
  const [team, tournament] = await Promise.all([
    opts?.entityType === "tournament" ? Promise.resolve(null) : repo.findTeamByMinId(minId),
    opts?.entityType === "team" ? Promise.resolve(null) : repo.findTournamentByMinId(minId),
  ]);

  const teamExact = team?.minId === minId;
  const tournamentExact = tournament?.minId === minId;

  if (tournament && tournamentExact) {
    const rawData = await repo.getFullTournamentDataWithoutPlayers(tournament.id);
    const fullData = await enrichTournamentTeamsWithLogos(rawData);
    return { data: { type: "tournament", ...fullData } };
  }
  if (team && teamExact) {
    const fullData = await repo.getFullTeamDataWithoutPlayers(team.id);
    return { data: { type: "team", ...fullData } };
  }

  if (tournament) {
    const rawData = await repo.getFullTournamentDataWithoutPlayers(tournament.id);
    const fullData = await enrichTournamentTeamsWithLogos(rawData);
    return { data: { type: "tournament", ...fullData } };
  }
  if (team) {
    const fullData = await repo.getFullTeamDataWithoutPlayers(team.id);
    return { data: { type: "team", ...fullData } };
  }

  throw new Error("Entity not found with the given minId");
}
