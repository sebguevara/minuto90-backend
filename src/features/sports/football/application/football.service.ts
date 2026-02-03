import { footballApiClient } from "../infrastructure/football-api.client";
import type { Season, FixtureResponse } from "../infrastructure/football-api.client";

/**
 * Servicio de aplicación para Football
 */

/**
 * Obtiene la temporada actual de una liga
 */
export async function getCurrentSeasonForLeague(leagueId: number): Promise<Season | null> {
  return footballApiClient.getCurrentSeason(leagueId);
}

/**
 * Obtiene todas las temporadas de una liga
 */
export async function getLeagueSeasons(leagueId: number) {
  const leagues = await footballApiClient.getLeague(leagueId);

  if (!leagues || leagues.length === 0) {
    throw new Error("League not found");
  }

  return {
    league: leagues[0].league,
    country: leagues[0].country,
    seasons: leagues[0].seasons,
    currentSeason: leagues[0].seasons.find((s) => s.current) || null,
  };
}

/**
 * Obtiene los últimos N partidos de un equipo
 */
export async function getTeamLastMatches(
  teamId: number,
  leagueId: number,
  limit: number = 5
): Promise<FixtureResponse[]> {
  // Primero obtener la temporada actual
  const currentSeason = await footballApiClient.getCurrentSeason(leagueId);

  if (!currentSeason) {
    throw new Error("No current season found for this league");
  }

  console.log(`[getTeamLastMatches] Team: ${teamId}, League: ${leagueId}, Season: ${currentSeason.year}`);

  // Obtener TODOS los partidos del equipo en esa temporada
  const allFixtures = await footballApiClient.getTeamFixtures({
    team: teamId,
    season: currentSeason.year,
    league: leagueId,
  });

  console.log(`[getTeamLastMatches] Total fixtures found: ${allFixtures.length}`);

  // Filtrar solo partidos finalizados (todos los status que indican finalización)
  const finishedStatuses = ["FT", "AET", "PEN", "AWD", "WO"]; // FT=FullTime, AET=AfterExtraTime, PEN=Penalties, AWD=Awarded, WO=WalkOver
  const finishedFixtures = allFixtures.filter((fixture) =>
    finishedStatuses.includes(fixture.fixture.status.short)
  );

  console.log(`[getTeamLastMatches] Finished fixtures: ${finishedFixtures.length}`);

  // Ordenar por fecha descendente (más recientes primero) y tomar los últimos N
  const sortedFixtures = finishedFixtures
    .sort((a, b) => b.fixture.timestamp - a.fixture.timestamp)
    .slice(0, limit);

  console.log(`[getTeamLastMatches] Returning ${sortedFixtures.length} fixtures`);

  return sortedFixtures;
}

/**
 * Obtiene los próximos N partidos de un equipo
 */
export async function getTeamNextMatches(
  teamId: number,
  leagueId: number,
  limit: number = 5
): Promise<FixtureResponse[]> {
  // Primero obtener la temporada actual
  const currentSeason = await footballApiClient.getCurrentSeason(leagueId);

  if (!currentSeason) {
    throw new Error("No current season found for this league");
  }

  // Obtener TODOS los partidos del equipo en esa temporada
  const allFixtures = await footballApiClient.getTeamFixtures({
    team: teamId,
    season: currentSeason.year,
    league: leagueId,
  });

  // Obtener timestamp actual
  const now = Math.floor(Date.now() / 1000);

  // Filtrar solo partidos futuros o en vivo
  const upcomingFixtures = allFixtures.filter((fixture) => {
    const isNotFinished = !["FT", "AET", "PEN", "AWD", "WO", "CANC", "ABD"].includes(
      fixture.fixture.status.short
    );
    return isNotFinished || fixture.fixture.timestamp >= now;
  });

  // Ordenar por fecha ascendente (más próximos primero) y tomar los primeros N
  const sortedFixtures = upcomingFixtures
    .sort((a, b) => a.fixture.timestamp - b.fixture.timestamp)
    .slice(0, limit);

  return sortedFixtures;
}

/**
 * Obtiene todos los partidos de un equipo en la temporada actual
 */
export async function getTeamFixturesForCurrentSeason(
  teamId: number,
  leagueId: number,
  status?: string
): Promise<{
  season: Season;
  fixtures: FixtureResponse[];
}> {
  // Obtener la temporada actual
  const currentSeason = await footballApiClient.getCurrentSeason(leagueId);

  if (!currentSeason) {
    throw new Error("No current season found for this league");
  }

  // Obtener todos los partidos del equipo en esa temporada
  const fixtures = await footballApiClient.getTeamFixtures({
    team: teamId,
    season: currentSeason.year,
    league: leagueId,
    ...(status && { status }),
  });

  return {
    season: currentSeason,
    fixtures,
  };
}

/**
 * Obtiene un partido específico por ID
 */
export async function getFixtureById(fixtureId: number): Promise<FixtureResponse | null> {
  return footballApiClient.getFixtureById(fixtureId);
}

/**
 * Obtiene estadísticas de un equipo en la temporada actual
 */
export async function getTeamStatisticsForCurrentSeason(
  teamId: number,
  leagueId: number
) {
  // Obtener la temporada actual
  const currentSeason = await footballApiClient.getCurrentSeason(leagueId);

  if (!currentSeason) {
    throw new Error("No current season found for this league");
  }

  // Obtener estadísticas del equipo
  const statistics = await footballApiClient.getTeamStatistics({
    team: teamId,
    season: currentSeason.year,
    league: leagueId,
  });

  return {
    season: currentSeason,
    statistics,
  };
}
