import { whoscoredPrismaClient } from "../../../../lib/whoscored-client";

export async function findTeamByMinId(minId: number) {
  const db = whoscoredPrismaClient;
  return db.team.findFirst({
    where: { minId },
    include: { Country: true },
  });
}

