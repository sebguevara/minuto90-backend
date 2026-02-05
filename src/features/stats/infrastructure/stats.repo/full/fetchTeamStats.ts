import { whoscoredPrismaClient } from "../../../../../lib/whoscored-client";

export async function fetchTeamStats(teamId: number) {
  const db = whoscoredPrismaClient;
  const tournamentInclude = { Country: true, Region: true };

  const [performances, positionals, situationals, streaks] = await Promise.all([
    db.teamPerformanceStat.findMany({
      where: { teamId },
      include: { Tournament: { include: tournamentInclude }, TableType: true },
      orderBy: { rank: "asc" },
    }),
    db.teamPositionalStat.findMany({
      where: { teamId },
      include: {
        Tournament: { include: tournamentInclude },
        TableType: true,
        TableSection: true,
      },
    }),
    db.teamSituationalStat.findMany({
      where: { teamId },
      include: {
        Tournament: { include: tournamentInclude },
        TableType: true,
        TableSection: true,
      },
    }),
    db.teamStreakStat.findMany({
      where: { teamId },
      include: { Tournament: { include: tournamentInclude }, TableType: true },
      orderBy: { rank: "asc" },
    }),
  ]);

  return { performances, positionals, situationals, streaks };
}

