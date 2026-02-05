import { whoscoredPrismaClient } from "../../../../../lib/whoscored-client";

export async function fetchTeamTournaments(teamId: number) {
  const db = whoscoredPrismaClient;
  return db.teamInTournament.findMany({
    where: { teamId },
    include: {
      Tournament: { include: { Country: true, Region: true } },
      Season: true,
      Country: true,
    },
  });
}

