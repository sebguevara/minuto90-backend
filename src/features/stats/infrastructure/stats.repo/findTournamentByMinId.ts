import { whoscoredPrismaClient } from "../../../../lib/whoscored-client";

export async function findTournamentByMinId(minId: number) {
  const db = whoscoredPrismaClient;
  const byMinId = await db.tournament.findFirst({
    where: { minId },
    include: { Country: true, Region: true },
  });

  if (byMinId) return byMinId;

  // Fallback: permitir buscar por `id` cuando `minId` no está seteado.
  return db.tournament.findFirst({
    where: { id: minId },
    include: { Country: true, Region: true },
  });
}
