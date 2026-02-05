import { fetchTournamentAssistToGoal } from "./full/fetchTournamentAssistToGoal";
import { fetchTournamentBase } from "./full/fetchTournamentBase";
import { fetchTournamentTables } from "./full/fetchTournamentTables";
import { fetchTournamentTeamStats } from "./full/fetchTournamentTeamStats";
import { fetchTournamentTeams } from "./full/fetchTournamentTeams";
import { fetchTournamentTopTeamStats } from "./full/fetchTournamentTopTeamStats";

export async function getFullTournamentDataWithoutPlayers(tournamentId: number) {
  const [
    tournament,
    teams,
    teamStats,
    tournamentTables,
    topTeamStats,
    assistToGoal,
  ] = await Promise.all([
    fetchTournamentBase(tournamentId),
    fetchTournamentTeams(tournamentId),
    fetchTournamentTeamStats(tournamentId),
    fetchTournamentTables(tournamentId),
    fetchTournamentTopTeamStats(tournamentId),
    fetchTournamentAssistToGoal(tournamentId),
  ]);

  return {
    tournament,
    teams,
    teamStats,
    tournamentTables,
    topTeamStats,
    assistToGoal,
  };
}

