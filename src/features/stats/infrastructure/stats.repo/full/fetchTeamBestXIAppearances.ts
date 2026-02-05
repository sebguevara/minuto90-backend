import { whoscoredPrismaClient } from "../../../../../lib/whoscored-client";

export async function fetchTeamBestXIAppearances(teamId: number) {
  const db = whoscoredPrismaClient;
  return db.bestXIPlayer.findMany({
    where: { teamId },
    include: {
      BestXI: { include: { Tournament: { include: { Country: true, Region: true } } } },
      Player: { include: { Country: true } },
    },
    orderBy: { positionIndex: "asc" },
  });
}

