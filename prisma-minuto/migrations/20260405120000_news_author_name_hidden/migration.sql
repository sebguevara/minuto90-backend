-- AlterTable
ALTER TABLE "News" ADD COLUMN "authorName" TEXT,
                   ADD COLUMN "isHidden" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "News_isHidden_publishedAt_idx" ON "News"("isHidden", "publishedAt");
