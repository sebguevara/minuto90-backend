import { fetchTeamBase } from "./full/fetchTeamBase";
import { fetchTeamStats } from "./full/fetchTeamStats";
import { fetchTeamTables } from "./full/fetchTeamTables";
import { fetchTeamTopTeamStats } from "./full/fetchTeamTopTeamStats";
import { fetchTeamTournaments } from "./full/fetchTeamTournaments";

export async function getFullTeamDataWithoutPlayers(teamId: number) {
  const [team, tournaments, stats, tables, topTeamStats] = await Promise.all([
    fetchTeamBase(teamId),
    fetchTeamTournaments(teamId),
    fetchTeamStats(teamId),
    fetchTeamTables(teamId),
    fetchTeamTopTeamStats(teamId),
  ]);

  return {
    team,
    tournaments,
    performance: { all: stats.performances },
    positional: { all: stats.positionals },
    situational: { all: stats.situationals },
    streaks: { all: stats.streaks },
    tables,
    topTeamStats,
  };
}

