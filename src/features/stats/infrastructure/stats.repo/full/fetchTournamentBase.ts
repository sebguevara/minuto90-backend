import { whoscoredPrismaClient } from "../../../../../lib/whoscored-client";

export async function fetchTournamentBase(tournamentId: number) {
  const db = whoscoredPrismaClient;
  return db.tournament.findUnique({
    where: { id: tournamentId },
    include: { Country: true, Region: true },
  });
}

