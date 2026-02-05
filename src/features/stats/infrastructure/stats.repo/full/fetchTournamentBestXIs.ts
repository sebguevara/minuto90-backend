import { whoscoredPrismaClient } from "../../../../../lib/whoscored-client";

export async function fetchTournamentBestXIs(tournamentId: number) {
  const db = whoscoredPrismaClient;
  return db.bestXI.findMany({
    where: { tournamentId },
    include: {
      BestXIPlayer: {
        include: {
          Team: { include: { Country: true } },
          Player: { include: { Country: true } },
        },
        orderBy: { positionIndex: "asc" },
      },
    },
  });
}

