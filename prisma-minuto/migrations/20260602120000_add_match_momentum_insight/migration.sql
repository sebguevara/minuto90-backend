-- Insights de momentum generados durante el partido.
-- El modelo existía en schema.prisma pero nunca se creó la tabla, por lo que
-- saveMomentumInsight fallaba en silencio y nada se persistía.
-- Se usa IF NOT EXISTS para ser idempotente: si la tabla ya existiera (db push
-- manual previo), el deploy no falla.

-- ─── MatchMomentumInsight ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "MatchMomentumInsight" (
    "id" TEXT NOT NULL,
    "fixtureId" INTEGER NOT NULL,
    "minute" INTEGER NOT NULL,
    "signalType" TEXT NOT NULL,
    "team" TEXT NOT NULL,
    "narrative" TEXT NOT NULL,
    "cardTitle" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "stats" JSONB NOT NULL,
    "delta" JSONB NOT NULL,
    "probability" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchMomentumInsight_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MatchMomentumInsight_fixtureId_signalType_team_minute_key"
ON "MatchMomentumInsight"("fixtureId", "signalType", "team", "minute");

CREATE INDEX IF NOT EXISTS "MatchMomentumInsight_fixtureId_createdAt_idx"
ON "MatchMomentumInsight"("fixtureId", "createdAt");
