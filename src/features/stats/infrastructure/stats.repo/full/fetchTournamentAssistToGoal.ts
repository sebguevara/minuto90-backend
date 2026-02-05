import { whoscoredPrismaClient } from "../../../../../lib/whoscored-client";

export async function fetchTournamentAssistToGoal(tournamentId: number) {
  const db = whoscoredPrismaClient;
  return db.tournamentAssistToGoal.findMany({
    where: { tournamentId },
    include: {
      Team: { include: { Country: true } },
      Player_TournamentAssistToGoal_assistantIdToPlayer: { include: { Country: true } },
      Player_TournamentAssistToGoal_scorerIdToPlayer: { include: { Country: true } },
      TableType: true,
    },
    orderBy: { rank: "asc" },
  });
}

