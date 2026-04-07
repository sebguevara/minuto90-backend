-- Extend posts to support World Cup jersey galleries by country
ALTER TABLE "Post"
ADD COLUMN "type" TEXT DEFAULT 'general',
ADD COLUMN "category" TEXT,
ADD COLUMN "countryCode" TEXT,
ADD COLUMN "gallery" JSONB,
ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Post_context_type_category_createdAt_idx"
ON "Post"("context", "type", "category", "createdAt");

CREATE INDEX "Post_countryCode_createdAt_idx"
ON "Post"("countryCode", "createdAt");

CREATE INDEX "Post_displayOrder_createdAt_idx"
ON "Post"("displayOrder", "createdAt");
