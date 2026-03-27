import { footballService } from "../../sports/application/football.service";
import { findTeamByMinId } from "../../stats/infrastructure/stats.repo/findTeamByMinId";
import { fetchMatchProfile } from "../../stats/infrastructure/stats.repo/matchProfile";
import { redisConnection } from "../../../shared/redis/redis.connection";
import { logWarn } from "../../../shared/logging/logger";
import type { TeamComparisonProfile } from "../domain/comparator.types";

const CACHE_TTL_SECONDS = 60 * 60 * 6; // 6 hours

function buildCacheKey(teamApiId: number): string {
  const env = process.env.NODE_ENV ?? "development";
  return `minuto90:${env}:comparator:team:${teamApiId}:v1`;
}

function safeNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function sumCardMinutes(
  colorSection: Record<string, { total: number | null; percentage: string | null } | undefined> | undefined
): number {
  if (!colorSection) return 0;
  return Object.values(colorSection).reduce(
    (sum, section) => sum + (section?.total ?? 0),
    0
  );
}

async function fetchFromCache(key: string): Promise<TeamComparisonProfile | null> {
  try {
    const raw = await redisConnection.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as TeamComparisonProfile;
  } catch {
    return null;
  }
}

async function saveToCache(key: string, value: TeamComparisonProfile): Promise<void> {
  try {
    await redisConnection.set(key, JSON.stringify(value), "EX", CACHE_TTL_SECONDS);
  } catch (err) {
    logWarn("comparator.cache.set_failed", {
      key,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function getTeamProfile(teamApiId: number): Promise<TeamComparisonProfile> {
  const cacheKey = buildCacheKey(teamApiId);
  const cached = await fetchFromCache(cacheKey);
  if (cached) return cached;

  // 1. Find the team's current active league
  const leaguesEnvelope = await footballService.getLeagues({ team: teamApiId, current: true });
  const leagues = leaguesEnvelope.response ?? [];

  // Prefer league type "League" over cups
  const mainLeagueItem =
    leagues.find((l) => l.league.type === "League") ?? leagues[0];

  if (!mainLeagueItem) {
    throw new Error(`No active league found for team ${teamApiId}`);
  }

  const leagueId = mainLeagueItem.league.id;
  const currentSeason = mainLeagueItem.seasons.find((s) => s.current)?.year ?? new Date().getFullYear() - 1;

  // 2. Fetch team statistics from API-Football
  const statsEnvelope = await footballService.getTeamStatistics({
    team: teamApiId,
    season: currentSeason,
    league: leagueId,
  });

  const stats = statsEnvelope.response;

  const matchesPlayed = stats?.fixtures?.played?.total ?? 0;
  const wins = stats?.fixtures?.wins?.total ?? 0;
  const draws = stats?.fixtures?.draws?.total ?? 0;
  const losses = stats?.fixtures?.loses?.total ?? 0;
  const cleanSheets = stats?.clean_sheet?.total ?? 0;

  const goalsPerGame = safeNumber(stats?.goals?.for?.average?.total);
  const concededPerGame = safeNumber(stats?.goals?.against?.average?.total);
  const winsPerGame = matchesPlayed > 0 ? wins / matchesPlayed : null;
  const drawsPerGame = matchesPlayed > 0 ? draws / matchesPlayed : null;
  const lossesPerGame = matchesPlayed > 0 ? losses / matchesPlayed : null;
  const cleanSheetPct = matchesPlayed > 0 ? (cleanSheets / matchesPlayed) * 100 : null;

  const penaltyPctStr = stats?.penalty?.scored?.percentage;
  const penaltyScoredPct = penaltyPctStr ? parseFloat(penaltyPctStr.replace("%", "")) : null;

  const yellowCardsTotal = sumCardMinutes(stats?.cards?.yellow as any);
  const redCardsTotal = sumCardMinutes(stats?.cards?.red as any);
  const yellowCardsPerGame = matchesPlayed > 0 ? yellowCardsTotal / matchesPlayed : null;
  const redCardsPerGame = matchesPlayed > 0 ? redCardsTotal / matchesPlayed : null;

  // 3. Fetch WhoScored data (best-effort, team.minId = API-Football team ID)
  let shotsPg: number | null = null;
  let shotsOnTargetPg: number | null = null;
  let possessionAvg: number | null = null;
  let xgPerGame: number | null = null;
  let xgAgainstPerGame: number | null = null;
  let foulsPg: number | null = null;
  let offsidesPg: number | null = null;
  let strengths: string[] = [];
  let weaknesses: string[] = [];
  let styleOfPlay: string[] = [];

  try {
    const whoscoredTeam = await findTeamByMinId(teamApiId);
    if (whoscoredTeam) {
      const profile = await fetchMatchProfile(whoscoredTeam.id);

      // Summary top stats (viewTypeId=1 = Overall)
      const summaryOverall = profile.topStats.summary.find((s: any) => s.viewTypeId === 1);
      if (summaryOverall) {
        shotsPg = safeNumber(summaryOverall.shotsPg);
        possessionAvg = safeNumber(summaryOverall.possession);
      }

      // Offensive top stats (viewTypeId=1)
      const offensiveOverall = profile.topStats.offensive.find((s: any) => s.viewTypeId === 1);
      if (offensiveOverall) {
        if (shotsPg === null) shotsPg = safeNumber(offensiveOverall.shotsPg);
        shotsOnTargetPg = safeNumber(offensiveOverall.shotsOTpg);
      }

      // Defensive top stats (viewTypeId=1)
      const defensiveOverall = profile.topStats.defensive.find((s: any) => s.viewTypeId === 1);
      if (defensiveOverall) {
        foulsPg = safeNumber(defensiveOverall.foulsPg);
        offsidesPg = safeNumber(defensiveOverall.offsidesPg);
      }

      // xG top stats (viewTypeId=1, pensMode=all)
      const xgFor = profile.topStats.xg.find(
        (s: any) => s.viewTypeId === 1 && s.side === "for_team" && s.pensMode === "all"
      );
      const xgAgainst = profile.topStats.xg.find(
        (s: any) => s.viewTypeId === 1 && s.side === "against_team" && s.pensMode === "all"
      );
      if (xgFor) xgPerGame = safeNumber(xgFor.xG);
      if (xgAgainst) xgAgainstPerGame = safeNumber(xgAgainst.xG);

      // Characteristics
      strengths = profile.characteristics
        .filter((c: any) => c.kind === "strength")
        .map((c: any) => c.label);
      weaknesses = profile.characteristics
        .filter((c: any) => c.kind === "weakness")
        .map((c: any) => c.label);

      // Style of play
      styleOfPlay = profile.styleOfPlay.map((s: any) => s.label);
    }
  } catch (err) {
    logWarn("comparator.whoscored.fetch_failed", {
      teamApiId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const profile: TeamComparisonProfile = {
    teamId: teamApiId,
    teamName: stats?.team?.name ?? `Team ${teamApiId}`,
    teamLogo: stats?.team?.logo ?? null,
    leagueName: mainLeagueItem.league.name,
    leagueId,
    leagueLogo: mainLeagueItem.league.logo ?? null,
    season: currentSeason,
    matchesPlayed,
    goalsPerGame,
    concededPerGame,
    winsPerGame,
    drawsPerGame,
    lossesPerGame,
    cleanSheetPct,
    penaltyScoredPct,
    yellowCardsPerGame,
    redCardsPerGame,
    shotsPg,
    shotsOnTargetPg,
    possessionAvg,
    xgPerGame,
    xgAgainstPerGame,
    foulsPg,
    offsidesPg,
    strengths,
    weaknesses,
    styleOfPlay,
  };

  await saveToCache(cacheKey, profile);
  return profile;
}

export async function compareTeams(teamIds: number[]): Promise<TeamComparisonProfile[]> {
  return Promise.all(teamIds.map((id) => getTeamProfile(id)));
}
