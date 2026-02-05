import { whoscoredPrismaClient } from "../../../../lib/whoscored-client";
import type { TopPlayerMetric } from "../../dtos/stats.dto";

export async function listTeamTopPlayers(
  teamId: number,
  tournamentId: number,
  viewTypeId: number,
  metric: TopPlayerMetric,
  limit: number
) {
  const db = whoscoredPrismaClient;

  const includeConfig = {
    Player: { include: { Country: true } },
    Team: { include: { Country: true } },
    Tournament: { include: { Country: true, Region: true } },
    TableType: true,
  };

  switch (metric) {
    case "rating":
      return db.topPlayerRating.findMany({
        where: { teamId, tournamentId, viewTypeId },
        include: includeConfig,
        take: limit,
        orderBy: [{ rank: "asc" }, { rating: "desc" }],
      });
    case "assist":
      return db.topPlayerAssist.findMany({
        where: { teamId, tournamentId, viewTypeId },
        include: includeConfig,
        take: limit,
        orderBy: [{ rank: "asc" }, { assists: "desc" }],
      });
    case "shot":
      return db.topPlayerShot.findMany({
        where: { teamId, tournamentId, viewTypeId },
        include: includeConfig,
        take: limit,
        orderBy: [{ rank: "asc" }, { shotsPerGame: "desc" }],
      });
    case "aggression":
      return db.topPlayerAggression.findMany({
        where: { teamId, tournamentId, viewTypeId },
        include: includeConfig,
        take: limit,
        orderBy: [{ rank: "asc" }],
      });
    case "goalContribution":
      return db.topPlayerGoalContribution.findMany({
        where: { teamId, tournamentId, viewTypeId },
        include: includeConfig,
        take: limit,
        orderBy: [{ rank: "asc" }, { contributionPercent: "desc" }],
      });
  }
}

