import { whoscoredPrismaClient } from "../../../../../lib/whoscored-client";

export async function fetchTournamentTeamStats(tournamentId: number) {
  const db = whoscoredPrismaClient;
  const teamInclude = { Team: { include: { Country: true } } };

  const [performance, positional, situational, streaks] = await Promise.all([
    db.teamPerformanceStat.findMany({
      where: { tournamentId },
      include: { ...teamInclude, TableType: true },
      orderBy: { rank: "asc" },
    }),
    db.teamPositionalStat.findMany({
      where: { tournamentId },
      include: { ...teamInclude, TableType: true, TableSection: true },
    }),
    db.teamSituationalStat.findMany({
      where: { tournamentId },
      include: { ...teamInclude, TableType: true, TableSection: true },
    }),
    db.teamStreakStat.findMany({
      where: { tournamentId },
      include: { ...teamInclude, TableType: true },
      orderBy: { rank: "asc" },
    }),
  ]);

  return { performance, positional, situational, streaks };
}

