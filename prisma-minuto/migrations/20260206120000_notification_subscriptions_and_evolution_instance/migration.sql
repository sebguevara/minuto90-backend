-- Enable UUID generation for `@default(uuid())` on PostgreSQL.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "NotificationSubscriber" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "phoneNumber" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "NotificationSubscriber_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationSubscriber_phoneNumber_key" ON "NotificationSubscriber"("phoneNumber");

CREATE TABLE "MatchSubscription" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subscriberId" UUID NOT NULL,
    "fixtureId" INTEGER NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "leagueName" TEXT,
    "matchDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MatchSubscription_subscriberId_fixtureId_key" ON "MatchSubscription"("subscriberId", "fixtureId");
CREATE INDEX "MatchSubscription_fixtureId_idx" ON "MatchSubscription"("fixtureId");

ALTER TABLE "MatchSubscription"
ADD CONSTRAINT "MatchSubscription_subscriberId_fkey"
FOREIGN KEY ("subscriberId") REFERENCES "NotificationSubscriber"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "EvolutionInstance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "instanceName" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvolutionInstance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EvolutionInstance_instanceName_key" ON "EvolutionInstance"("instanceName");

