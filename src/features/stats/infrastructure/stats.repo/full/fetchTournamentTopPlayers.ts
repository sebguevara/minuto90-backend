import { whoscoredPrismaClient } from "../../../../../lib/whoscored-client";

export async function fetchTournamentTopPlayers(tournamentId: number) {
  const db = whoscoredPrismaClient;
  const include = {
    Player: { include: { Country: true } },
    Team: { include: { Country: true } },
    TableType: true,
  };

  const [
    rating,
    assist,
    shot,
    aggression,
    goalContribution,
  ] = await Promise.all([
    db.topPlayerRating.findMany({ where: { tournamentId }, include, orderBy: { rank: "asc" } }),
    db.topPlayerAssist.findMany({ where: { tournamentId }, include, orderBy: { rank: "asc" } }),
    db.topPlayerShot.findMany({ where: { tournamentId }, include, orderBy: { rank: "asc" } }),
    db.topPlayerAggression.findMany({ where: { tournamentId }, include, orderBy: { rank: "asc" } }),
    db.topPlayerGoalContribution.findMany({ where: { tournamentId }, include, orderBy: { rank: "asc" } }),
  ]);

  return { rating, assist, shot, aggression, goalContribution };
}

