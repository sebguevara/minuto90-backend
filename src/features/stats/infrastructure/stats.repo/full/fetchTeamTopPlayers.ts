import { whoscoredPrismaClient } from "../../../../../lib/whoscored-client";

export async function fetchTeamTopPlayers(teamId: number) {
  const db = whoscoredPrismaClient;
  const include = {
    Player: { include: { Country: true } },
    Tournament: { include: { Country: true, Region: true } },
    TableType: true,
  };

  const [
    rating,
    assist,
    shot,
    aggression,
    goalContribution,
  ] = await Promise.all([
    db.topPlayerRating.findMany({ where: { teamId }, include, orderBy: { rank: "asc" } }),
    db.topPlayerAssist.findMany({ where: { teamId }, include, orderBy: { rank: "asc" } }),
    db.topPlayerShot.findMany({ where: { teamId }, include, orderBy: { rank: "asc" } }),
    db.topPlayerAggression.findMany({ where: { teamId }, include, orderBy: { rank: "asc" } }),
    db.topPlayerGoalContribution.findMany({ where: { teamId }, include, orderBy: { rank: "asc" } }),
  ]);

  return { rating, assist, shot, aggression, goalContribution };
}

