import { PrismaClient } from "@prisma-minuto/minuto-client-types/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.MINUTO_DATABASE_URL,
});

const getPrisma = () =>
  new PrismaClient({
    adapter,
  });

const globalForMinutoPrismaClient = global as unknown as {
  minutoPrismaClient: ReturnType<typeof getPrisma>;
};

export const minutoPrismaClient =
  globalForMinutoPrismaClient.minutoPrismaClient || getPrisma();

if (process.env.NODE_ENV !== "production")
  globalForMinutoPrismaClient.minutoPrismaClient = minutoPrismaClient;
