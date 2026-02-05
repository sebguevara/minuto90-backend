import { whoscoredPrismaClient } from "../../../../../lib/whoscored-client";

export async function fetchTeamBase(teamId: number) {
  const db = whoscoredPrismaClient;
  return db.team.findUnique({
    where: { id: teamId },
    include: { Country: true },
  });
}

