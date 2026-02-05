import { whoscoredPrismaClient } from "../../../../../lib/whoscored-client";

export async function fetchCharacteristics(teamId: number) {
  return whoscoredPrismaClient.teamCharacteristic.findMany({
    where: { teamId },
    orderBy: [{ kind: "asc" }, { area: "asc" }, { label: "asc" }],
  });
}
