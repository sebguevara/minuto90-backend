ALTER TABLE "PushSubscription"
ADD COLUMN "userId" TEXT,
ADD COLUMN "userAgent" TEXT,
ADD COLUMN "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "News"
ADD COLUMN "pushSentAt" TIMESTAMP(3);

ALTER TABLE "PushSubscription"
ADD CONSTRAINT "PushSubscription_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");
CREATE INDEX "PushSubscription_lastSeenAt_idx" ON "PushSubscription"("lastSeenAt");
CREATE INDEX "News_pushSentAt_idx" ON "News"("pushSentAt");

UPDATE "News"
SET "pushSentAt" = CURRENT_TIMESTAMP
WHERE "isDeleted" = false
  AND "publishedAt" <= CURRENT_TIMESTAMP
  AND ("publishFrom" IS NULL OR "publishFrom" <= CURRENT_TIMESTAMP)
  AND ("publishTo" IS NULL OR "publishTo" >= CURRENT_TIMESTAMP);
