import { fetchTournamentAssistToGoal } from "./full/fetchTournamentAssistToGoal";
import { fetchTournamentBase } from "./full/fetchTournamentBase";
import { fetchTournamentBestXIs } from "./full/fetchTournamentBestXIs";
import { fetchTournamentPlayerTables } from "./full/fetchTournamentPlayerTables";
import { fetchTournamentTables } from "./full/fetchTournamentTables";
import { fetchTournamentTeamStats } from "./full/fetchTournamentTeamStats";
import { fetchTournamentTeams } from "./full/fetchTournamentTeams";
import { fetchTournamentTopPlayers } from "./full/fetchTournamentTopPlayers";
import { fetchTournamentTopTeamStats } from "./full/fetchTournamentTopTeamStats";

export async function getFullTournamentData(
  tournamentId: number,
  opts?: { playerTables?: "global" | "tournament" }
) {
  const [
    tournament,
    teams,
    teamStats,
    topPlayers,
    tournamentTables,
    playerTables,
    topTeamStats,
    bestXIs,
    assistToGoal,
  ] = await Promise.all([
    fetchTournamentBase(tournamentId),
    fetchTournamentTeams(tournamentId),
    fetchTournamentTeamStats(tournamentId),
    fetchTournamentTopPlayers(tournamentId),
    fetchTournamentTables(tournamentId),
    fetchTournamentPlayerTables(tournamentId, opts?.playerTables ?? "tournament"),
    fetchTournamentTopTeamStats(tournamentId),
    fetchTournamentBestXIs(tournamentId),
    fetchTournamentAssistToGoal(tournamentId),
  ]);

  return {
    tournament,
    teams,
    teamStats,
    topPlayers,
    tournamentTables,
    playerTables,
    topTeamStats,
    bestXIs,
    assistToGoal,
  };
}
