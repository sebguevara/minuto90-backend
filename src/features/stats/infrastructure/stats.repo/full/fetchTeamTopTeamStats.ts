import { whoscoredPrismaClient } from "../../../../../lib/whoscored-client";

export async function fetchTeamTopTeamStats(teamId: number) {
  const db = whoscoredPrismaClient;
  return db.topTeamStat.findMany({
    where: { teamId },
    include: { Tournament: { include: { Country: true, Region: true } }, TableType: true },
    orderBy: { rank: "asc" },
  });
}

