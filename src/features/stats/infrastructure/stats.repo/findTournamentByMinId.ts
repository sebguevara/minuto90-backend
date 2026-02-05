import { whoscoredPrismaClient } from "../../../../lib/whoscored-client";

export async function findTournamentByMinId(minId: number) {
  const db = whoscoredPrismaClient;
  return db.tournament.findFirst({
    where: { minId },
    include: { Country: true, Region: true },
  });
}

