import {
  createOddsIntegrationNotFoundError,
  createOddsIntegrationValidationError,
} from "../domain/odds-integration.errors";
import type {
  OddsSource,
  OddsTeamAliasRecord,
  OddsTournamentMappingRecord,
} from "../domain/odds-integration.types";
import { normalizeTeamName } from "../infrastructure/normalize-team-name";
import {
  teamAliasRepository,
  type TeamAliasRepository,
} from "../infrastructure/team-alias.repository";
import {
  tournamentMappingRepository,
  type TournamentMappingRepository,
} from "../infrastructure/tournament-mapping.repository";

/**
 * Servicio admin: alta/baja de tournament mappings y team aliases.
 *
 * Es la pieza que el panel admin (o el script de seed) usan para llenar las
 * tablas. El use case de lookup sólo lee — la separación garantiza que el
 * usuario final nunca pueda modificar mappings.
 */
export interface OddsMappingAdminServiceContract {
  upsertTournamentMapping(input: UpsertTournamentMappingInput): Promise<OddsTournamentMappingRecord>;
  deleteTournamentMapping(id: string): Promise<void>;

  upsertTeamAlias(input: UpsertTeamAliasInput): Promise<OddsTeamAliasRecord>;
  deleteTeamAlias(id: string): Promise<void>;
}

export interface UpsertTournamentMappingInput {
  source: OddsSource;
  sportId: number;
  countryId: number;
  tournamentId: number;
  apifootballLeagueId: number;
  /** `null` actúa como wildcard de season. */
  apifootballSeason: number | null;
  status?: OddsTournamentMappingRecord["status"];
  notes?: string | null;
  verifiedBy?: string | null;
}

export interface UpsertTeamAliasInput {
  source: OddsSource;
  sportId: number;
  externalName: string;
  apifootballTeamId: number;
  /** Si se omite, se asume 1.0 (verificado manualmente). */
  confidence?: number;
  verifiedBy?: string | null;
}

const validatePositiveInt = (value: number, field: string) => {
  if (!Number.isInteger(value) || value <= 0) {
    throw createOddsIntegrationValidationError(
      `El parámetro ${field} debe ser un número entero positivo`
    );
  }
};

export class OddsMappingAdminService implements OddsMappingAdminServiceContract {
  constructor(
    private readonly tournamentRepo: TournamentMappingRepository = tournamentMappingRepository,
    private readonly aliasRepo: TeamAliasRepository = teamAliasRepository
  ) {}

  async upsertTournamentMapping(input: UpsertTournamentMappingInput) {
    validatePositiveInt(input.sportId, "sportId");
    validatePositiveInt(input.countryId, "countryId");
    validatePositiveInt(input.tournamentId, "tournamentId");
    validatePositiveInt(input.apifootballLeagueId, "apifootballLeagueId");
    if (input.apifootballSeason !== null) {
      validatePositiveInt(input.apifootballSeason, "apifootballSeason");
    }

    return this.tournamentRepo.upsert({
      source: input.source,
      sportId: input.sportId,
      countryId: input.countryId,
      tournamentId: input.tournamentId,
      apifootballLeagueId: input.apifootballLeagueId,
      apifootballSeason: input.apifootballSeason,
      status: input.status ?? "confirmed",
      confidence: 1, // mapeo manual = confianza máxima
      notes: input.notes ?? null,
      verifiedBy: input.verifiedBy ?? null,
    });
  }

  async deleteTournamentMapping(id: string) {
    if (!id) {
      throw createOddsIntegrationValidationError("El parámetro id es obligatorio");
    }
    const ok = await this.tournamentRepo.deleteById(id);
    if (!ok) {
      throw createOddsIntegrationNotFoundError(
        "El mapeo de torneo solicitado no existe"
      );
    }
  }

  async upsertTeamAlias(input: UpsertTeamAliasInput) {
    validatePositiveInt(input.sportId, "sportId");
    validatePositiveInt(input.apifootballTeamId, "apifootballTeamId");
    if (!input.externalName?.trim()) {
      throw createOddsIntegrationValidationError(
        "El parámetro externalName es obligatorio"
      );
    }

    const normalized = normalizeTeamName(input.externalName);
    if (!normalized) {
      throw createOddsIntegrationValidationError(
        "El parámetro externalName no produce un nombre normalizable"
      );
    }

    return this.aliasRepo.upsert({
      source: input.source,
      sportId: input.sportId,
      externalName: input.externalName.trim(),
      normalizedName: normalized,
      apifootballTeamId: input.apifootballTeamId,
      confidence: input.confidence ?? 1,
      verifiedBy: input.verifiedBy ?? null,
    });
  }

  async deleteTeamAlias(id: string) {
    if (!id) {
      throw createOddsIntegrationValidationError("El parámetro id es obligatorio");
    }
    const ok = await this.aliasRepo.deleteById(id);
    if (!ok) {
      throw createOddsIntegrationNotFoundError(
        "El alias de equipo solicitado no existe"
      );
    }
  }
}

export const oddsMappingAdminService = new OddsMappingAdminService();
