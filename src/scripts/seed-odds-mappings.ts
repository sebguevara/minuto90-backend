/**
 * Script de seed de mappings odds-integration.
 *
 * Uso:
 *   bun run cache:seed:odds                       # usa data/odds-mappings.seed.json
 *   bun run cache:seed:odds path/to/file.json     # archivo custom
 *
 * Es idempotente: cada entrada hace upsert. Re-ejecutar no duplica filas.
 *
 * Formato esperado del JSON: ver `data/odds-mappings.seed.example.json`.
 *   {
 *     "tournaments": [{ source, sportId, countryId, tournamentId,
 *                       apifootballLeagueId, apifootballSeason, status?, notes? }],
 *     "aliases":     [{ source, sportId, externalName, apifootballTeamId, confidence? }]
 *   }
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { logError, logInfo } from "../shared/logging/logger";
import { oddsMappingAdminService } from "../features/odds-integration/application/odds-mapping-admin.service";
import type { OddsSource } from "../features/odds-integration/domain/odds-integration.types";

interface RawTournament {
  source?: OddsSource;
  sportId: number;
  countryId: number;
  tournamentId: number;
  apifootballLeagueId: number;
  apifootballSeason: number | null;
  status?: "suggested" | "confirmed" | "rejected";
  notes?: string | null;
  _label?: string;
}

interface RawAlias {
  source?: OddsSource;
  sportId: number;
  externalName: string;
  apifootballTeamId: number;
  confidence?: number;
  _label?: string;
}

interface SeedFile {
  tournaments?: RawTournament[];
  aliases?: RawAlias[];
}

const DEFAULT_PATH = "data/odds-mappings.seed.json";

const seedFilePath = (process.argv[2] ?? DEFAULT_PATH).trim();

const main = async () => {
  const absolute = resolve(process.cwd(), seedFilePath);
  logInfo("odds_seed.start", { file: absolute });

  let raw: string;
  try {
    raw = await readFile(absolute, "utf-8");
  } catch (error) {
    logError("odds_seed.read_failed", {
      file: absolute,
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }

  let parsed: SeedFile;
  try {
    parsed = JSON.parse(raw) as SeedFile;
  } catch (error) {
    logError("odds_seed.parse_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }

  const tournaments = parsed.tournaments ?? [];
  const aliases = parsed.aliases ?? [];

  let tournamentOk = 0;
  let tournamentFail = 0;
  for (const entry of tournaments) {
    try {
      await oddsMappingAdminService.upsertTournamentMapping({
        source: entry.source ?? "kickertech",
        sportId: entry.sportId,
        countryId: entry.countryId,
        tournamentId: entry.tournamentId,
        apifootballLeagueId: entry.apifootballLeagueId,
        apifootballSeason: entry.apifootballSeason,
        status: entry.status,
        notes: entry.notes ?? null,
        verifiedBy: "seed-script",
      });
      tournamentOk += 1;
    } catch (error) {
      tournamentFail += 1;
      logError("odds_seed.tournament_failed", {
        label: entry._label,
        tournamentId: entry.tournamentId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  let aliasOk = 0;
  let aliasFail = 0;
  for (const entry of aliases) {
    try {
      await oddsMappingAdminService.upsertTeamAlias({
        source: entry.source ?? "kickertech",
        sportId: entry.sportId,
        externalName: entry.externalName,
        apifootballTeamId: entry.apifootballTeamId,
        confidence: entry.confidence,
        verifiedBy: "seed-script",
      });
      aliasOk += 1;
    } catch (error) {
      aliasFail += 1;
      logError("odds_seed.alias_failed", {
        label: entry._label,
        externalName: entry.externalName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logInfo("odds_seed.done", {
    tournamentsOk: tournamentOk,
    tournamentsFail: tournamentFail,
    aliasesOk: aliasOk,
    aliasesFail: aliasFail,
  });

  if (tournamentFail || aliasFail) process.exit(2);
  process.exit(0);
};

main().catch((error) => {
  logError("odds_seed.fatal", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
