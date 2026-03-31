ALTER TABLE "NotificationSubscriber"
ADD COLUMN "countryCode" TEXT,
ADD COLUMN "dialCode" TEXT,
ADD COLUMN "nationalNumber" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "notifyPreMatch30m" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "notifyKickoff" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "notifyGoals" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "notifyRedCards" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "notifyVarCancelled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "notifyHalftime" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "notifySecondHalf" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "notifyFullTime" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "NotificationSubscriber"
ALTER COLUMN "phoneNumber" DROP NOT NULL;

WITH ranked AS (
  SELECT
    "id",
    "userId",
    ROW_NUMBER() OVER (
      PARTITION BY "userId"
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS "rn",
    FIRST_VALUE("id") OVER (
      PARTITION BY "userId"
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS "keepId"
  FROM "NotificationSubscriber"
  WHERE "userId" IS NOT NULL
)
UPDATE "MatchSubscription" AS "subscription"
SET "subscriberId" = ranked."keepId"
FROM ranked
WHERE ranked."rn" > 1
  AND "subscription"."subscriberId" = ranked."id"
  AND "subscription"."subscriberId" <> ranked."keepId"
  AND NOT EXISTS (
    SELECT 1
    FROM "MatchSubscription" AS "existing"
    WHERE "existing"."subscriberId" = ranked."keepId"
      AND "existing"."fixtureId" = "subscription"."fixtureId"
  );

WITH ranked AS (
  SELECT
    "id",
    "userId",
    ROW_NUMBER() OVER (
      PARTITION BY "userId"
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS "rn"
  FROM "NotificationSubscriber"
  WHERE "userId" IS NOT NULL
)
DELETE FROM "MatchSubscription" AS "subscription"
USING ranked
WHERE ranked."rn" > 1
  AND "subscription"."subscriberId" = ranked."id";

WITH ranked AS (
  SELECT
    "id",
    "userId",
    ROW_NUMBER() OVER (
      PARTITION BY "userId"
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS "rn"
  FROM "NotificationSubscriber"
  WHERE "userId" IS NOT NULL
)
DELETE FROM "NotificationSubscriber" AS "subscriber"
USING ranked
WHERE ranked."rn" > 1
  AND ranked."id" = "subscriber"."id";

CREATE UNIQUE INDEX "NotificationSubscriber_userId_key" ON "NotificationSubscriber"("userId");

ALTER TABLE "MatchSubscription"
ADD COLUMN "homeTeamId" INTEGER,
ADD COLUMN "awayTeamId" INTEGER,
ADD COLUMN "sourceType" TEXT,
ADD COLUMN "sourceEntityId" INTEGER;

CREATE INDEX "MatchSubscription_subscriberId_sourceType_sourceEntityId_idx"
ON "MatchSubscription"("subscriberId", "sourceType", "sourceEntityId");
