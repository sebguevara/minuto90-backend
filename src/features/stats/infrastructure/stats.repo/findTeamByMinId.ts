import { whoscoredPrismaClient } from "../../../../lib/whoscored-client";

export async function findTeamByMinId(minId: number) {
  const db = whoscoredPrismaClient;
  const byMinId = await db.team.findFirst({
    where: { minId },
    include: { Country: true },
  });

  if (byMinId) return byMinId;

  // Fallback: algunos datasets guardan el id externo en `id` y dejan `minId` null.
  return db.team.findFirst({
    where: { id: minId },
    include: { Country: true },
  });
}
