-- CreateTable
CREATE TABLE "NewsTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_NewsToNewsTags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_NewsToNewsTags_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsTag_slug_key" ON "NewsTag"("slug");

-- CreateIndex
CREATE INDEX "NewsTag_slug_idx" ON "NewsTag"("slug");

-- CreateIndex
CREATE INDEX "_NewsToNewsTags_B_index" ON "_NewsToNewsTags"("B");

-- AddForeignKey
ALTER TABLE "_NewsToNewsTags" ADD CONSTRAINT "_NewsToNewsTags_A_fkey" FOREIGN KEY ("A") REFERENCES "News"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_NewsToNewsTags" ADD CONSTRAINT "_NewsToNewsTags_B_fkey" FOREIGN KEY ("B") REFERENCES "NewsTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
