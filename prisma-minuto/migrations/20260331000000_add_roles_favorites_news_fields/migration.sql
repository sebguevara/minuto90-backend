-- AlterTable: Add role to User
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';

-- AlterTable: Add featured and publish range to News
ALTER TABLE "News" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "News" ADD COLUMN "publishFrom" TIMESTAMP(3);
ALTER TABLE "News" ADD COLUMN "publishTo" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "News_featured_isDeleted_idx" ON "News"("featured", "isDeleted");

-- CreateTable: Favorite
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Favorite_userId_sport_idx" ON "Favorite"("userId", "sport");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_sport_entityType_entityId_key" ON "Favorite"("userId", "sport", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
