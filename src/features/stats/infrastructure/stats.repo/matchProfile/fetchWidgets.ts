import { whoscoredPrismaClient } from "../../../../../lib/whoscored-client";

export async function fetchWidgets(teamId: number) {
  return whoscoredPrismaClient.teamSituationalWidget.findMany({
    where: { teamId },
    orderBy: [{ category: "asc" }, { view: "asc" }, { side: "asc" }, { type: "asc" }],
  });
}
