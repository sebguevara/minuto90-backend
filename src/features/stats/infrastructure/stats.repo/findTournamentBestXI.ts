import { whoscoredPrismaClient } from "../../../../lib/whoscored-client";

export async function findTournamentBestXI(
  tournamentId: number,
  timeframe: string,
  startDate: string,
  endDate: string
) {
  const db = whoscoredPrismaClient;
  return db.bestXI.findFirst({
    where: {
      tournamentId,
      timeframe,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    },
    include: {
      Tournament: { include: { Country: true, Region: true } },
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

