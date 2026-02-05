import { whoscoredPrismaClient } from "../../../../../lib/whoscored-client";

export async function fetchTournamentTeams(tournamentId: number) {
  const db = whoscoredPrismaClient;
  return db.teamInTournament.findMany({
    where: { tournamentId },
    include: {
      Team: { include: { Country: true } },
      Country: true,
      Season: true,
    },
  });
}

