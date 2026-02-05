import { whoscoredPrismaClient } from "../../../../../lib/whoscored-client";

const db = whoscoredPrismaClient;
const tournamentInclude = { Country: true, Region: true } as const;

export async function fetchTopStats(teamId: number) {
  const [summary, offensive, defensive, xg] = await Promise.all([
    db.teamTopStatSummary.findMany({
      where: { teamId },
      include: { Tournament: { include: tournamentInclude }, TableType: true },
      orderBy: { createdAt: "desc" },
    }),
    db.teamTopStatOffensive.findMany({
      where: { teamId },
      include: { Tournament: { include: tournamentInclude }, TableType: true },
      orderBy: { createdAt: "desc" },
    }),
    db.teamTopStatDefensive.findMany({
      where: { teamId },
      include: { Tournament: { include: tournamentInclude }, TableType: true },
      orderBy: { createdAt: "desc" },
    }),
    db.teamTopStatXG.findMany({
      where: { teamId },
      include: { Tournament: { include: tournamentInclude }, TableType: true },
      orderBy: [{ side: "asc" }, { pensMode: "asc" }],
    }),
  ]);

  return { summary, offensive, defensive, xg };
}
