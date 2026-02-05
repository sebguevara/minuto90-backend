import { whoscoredPrismaClient } from "../../../../lib/whoscored-client";

export async function listTableCategories() {
  const db = whoscoredPrismaClient;
  return db.tableCategory.findMany({ orderBy: { id: "asc" } });
}

