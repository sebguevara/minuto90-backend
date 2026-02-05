import { whoscoredPrismaClient } from "../../../../lib/whoscored-client";

export async function listTableTypes() {
  const db = whoscoredPrismaClient;
  return db.tableType.findMany({ orderBy: { id: "asc" } });
}

