import { whoscoredPrismaClient } from "../../../../lib/whoscored-client";

export async function listTableSections() {
  const db = whoscoredPrismaClient;
  return db.tableSection.findMany({ orderBy: { id: "asc" } });
}

