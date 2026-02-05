import { whoscoredPrismaClient } from "../../../../../lib/whoscored-client";

export async function fetchTournamentTopTeamStats(tournamentId: number) {
  const db = whoscoredPrismaClient;
  return db.topTeamStat.findMany({
    where: { tournamentId },
    include: { Team: { include: { Country: true } }, TableType: true },
    orderBy: { rank: "asc" },
  });
}

