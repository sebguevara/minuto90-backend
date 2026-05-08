-- Tablas de mapeo entre proveedores de cuotas (Kickertech) y api-football.
-- No modifican modelos existentes.

-- ─── OddsTournamentMapping ──────────────────────────────────────────────────
CREATE TABLE "OddsTournamentMapping" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sportId" INTEGER NOT NULL,
    "countryId" INTEGER NOT NULL,
    "tournamentId" INTEGER NOT NULL,
    "apifootballLeagueId" INTEGER NOT NULL,
    "apifootballSeason" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "confidence" DOUBLE PRECISION,
    "notes" TEXT,
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OddsTournamentMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OddsTournamentMapping_source_tournamentId_apifootballSeason_key"
ON "OddsTournamentMapping"("source", "tournamentId", "apifootballSeason");

CREATE INDEX "OddsTournamentMapping_source_apifootballLeagueId_idx"
ON "OddsTournamentMapping"("source", "apifootballLeagueId");

CREATE INDEX "OddsTournamentMapping_source_sportId_countryId_idx"
ON "OddsTournamentMapping"("source", "sportId", "countryId");

CREATE INDEX "OddsTournamentMapping_status_idx"
ON "OddsTournamentMapping"("status");

-- ─── OddsEventMapping ───────────────────────────────────────────────────────
CREATE TABLE "OddsEventMapping" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sportId" INTEGER NOT NULL,
    "externalEventId" INTEGER NOT NULL,
    "apifootballFixtureId" INTEGER NOT NULL,
    "matchDate" TIMESTAMP(3) NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'auto',
    "matchedBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OddsEventMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OddsEventMapping_source_externalEventId_key"
ON "OddsEventMapping"("source", "externalEventId");

CREATE UNIQUE INDEX "OddsEventMapping_source_apifootballFixtureId_key"
ON "OddsEventMapping"("source", "apifootballFixtureId");

CREATE INDEX "OddsEventMapping_apifootballFixtureId_idx"
ON "OddsEventMapping"("apifootballFixtureId");

CREATE INDEX "OddsEventMapping_source_sportId_expiresAt_idx"
ON "OddsEventMapping"("source", "sportId", "expiresAt");

-- ─── OddsTeamAlias ──────────────────────────────────────────────────────────
CREATE TABLE "OddsTeamAlias" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sportId" INTEGER NOT NULL,
    "externalName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "apifootballTeamId" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OddsTeamAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OddsTeamAlias_source_sportId_normalizedName_key"
ON "OddsTeamAlias"("source", "sportId", "normalizedName");

CREATE INDEX "OddsTeamAlias_apifootballTeamId_idx"
ON "OddsTeamAlias"("apifootballTeamId");

CREATE INDEX "OddsTeamAlias_source_sportId_idx"
ON "OddsTeamAlias"("source", "sportId");
