import { fetchTeamBase } from "./full/fetchTeamBase";
import { fetchTeamBestXIAppearances } from "./full/fetchTeamBestXIAppearances";
import { fetchTeamPlayerTables } from "./full/fetchTeamPlayerTables";
import { fetchTeamStats } from "./full/fetchTeamStats";
import { fetchTeamTables } from "./full/fetchTeamTables";
import { fetchTeamTopPlayers } from "./full/fetchTeamTopPlayers";
import { fetchTeamTopTeamStats } from "./full/fetchTeamTopTeamStats";
import { fetchTeamTournaments } from "./full/fetchTeamTournaments";

export async function getFullTeamData(teamId: number) {
  const [
    team,
    tournaments,
    stats,
    topPlayers,
    tables,
    playerTables,
    topTeamStats,
    bestXIAppearances,
  ] = await Promise.all([
    fetchTeamBase(teamId),
    fetchTeamTournaments(teamId),
    fetchTeamStats(teamId),
    fetchTeamTopPlayers(teamId),
    fetchTeamTables(teamId),
    fetchTeamPlayerTables(teamId),
    fetchTeamTopTeamStats(teamId),
    fetchTeamBestXIAppearances(teamId),
  ]);

  return {
    team,
    tournaments,
    performance: { all: stats.performances },
    positional: { all: stats.positionals },
    situational: { all: stats.situationals },
    streaks: { all: stats.streaks },
    topPlayers,
    tables,
    playerTables,
    topTeamStats,
    bestXIAppearances,
  };
}

