import { PrismaClient } from "../../prisma-whoscored/whoscored-client-types/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.WHOSCORED_DATABASE_URL,
});

const getPrisma = () =>
  new PrismaClient({
    adapter,
  });

const globalForWhoscoredPrismaClient = global as unknown as {
  whoscoredPrismaClient: ReturnType<typeof getPrisma>;
};

export const whoscoredPrismaClient =
  globalForWhoscoredPrismaClient.whoscoredPrismaClient || getPrisma();

if (process.env.NODE_ENV !== "production")
  globalForWhoscoredPrismaClient.whoscoredPrismaClient = whoscoredPrismaClient;
