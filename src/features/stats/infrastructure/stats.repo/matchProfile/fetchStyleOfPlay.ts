import { whoscoredPrismaClient } from "../../../../../lib/whoscored-client";

export async function fetchStyleOfPlay(teamId: number) {
  return whoscoredPrismaClient.teamStyleOfPlay.findMany({
    where: { teamId },
    orderBy: [{ area: "asc" }, { label: "asc" }],
  });
}
