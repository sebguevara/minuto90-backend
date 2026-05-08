import { minutoPrismaClient } from "../../../lib/minuto-client";
import type {
  OddsSource,
  OddsTournamentMappingRecord,
} from "../domain/odds-integration.types";

/**
 * Acceso al mapeo de torneos. Es semi-permanente y se administra manualmente
 * (panel admin / script de seed). El use case sólo lee.
 */
export interface TournamentMappingRepository {
  /**
   * Busca el mapping aplicable: prefiere coincidencia exacta de season,
   * con fallback a `apifootballSeason = null` (wildcard).
   */
  findByApifootballLeague(
    source: OddsSource,
    apifootballLeagueId: number,
    season: number
  ): Promise<OddsTournamentMappingRecord | null>;

  /** Idempotente: única clave (source, tournamentId, apifootballSeason). */
  upsert(input: {
    source: OddsSource;
    sportId: number;
    countryId: number;
    tournamentId: number;
    apifootballLeagueId: number;
    apifootballSeason: number | null;
    status?: OddsTournamentMappingRecord["status"];
    confidence?: number | null;
    notes?: string | null;
    verifiedBy?: string | null;
  }): Promise<OddsTournamentMappingRecord>;

  deleteById(id: string): Promise<boolean>;

  listBySportAndCountry(
    source: OddsSource,
    sportId: number,
    countryId: number
  ): Promise<OddsTournamentMappingRecord[]>;

  listAllConfirmed(source: OddsSource): Promise<OddsTournamentMappingRecord[]>;
}

const toRecord = (row: Awaited<
  ReturnType<typeof minutoPrismaClient.oddsTournamentMapping.findFirst>
>): OddsTournamentMappingRecord | null => {
  if (!row) return null;
  return {
    id: row.id,
    source: row.source as OddsSource,
    sportId: row.sportId,
    countryId: row.countryId,
    tournamentId: row.tournamentId,
    apifootballLeagueId: row.apifootballLeagueId,
    apifootballSeason: row.apifootballSeason,
    status: row.status as OddsTournamentMappingRecord["status"],
    confidence: row.confidence,
    notes: row.notes,
    verifiedBy: row.verifiedBy,
  };
};

export class PrismaTournamentMappingRepository
  implements TournamentMappingRepository
{
  async findByApifootballLeague(
    source: OddsSource,
    apifootballLeagueId: number,
    season: number
  ): Promise<OddsTournamentMappingRecord | null> {
    // Prioriza row season-specific. Si no hay, fallback wildcard (season=null).
    const row = await minutoPrismaClient.oddsTournamentMapping.findFirst({
      where: {
        source,
        apifootballLeagueId,
        status: "confirmed",
        OR: [{ apifootballSeason: season }, { apifootballSeason: null }],
      },
      orderBy: [
        { apifootballSeason: "desc" }, // null queda al final → season-specific gana
      ],
    });
    return toRecord(row);
  }

  async upsert(input: {
    source: OddsSource;
    sportId: number;
    countryId: number;
    tournamentId: number;
    apifootballLeagueId: number;
    apifootballSeason: number | null;
    status?: OddsTournamentMappingRecord["status"];
    confidence?: number | null;
    notes?: string | null;
    verifiedBy?: string | null;
  }): Promise<OddsTournamentMappingRecord> {
    // Prisma no soporta `findUnique` con unique compuesto que incluye nullable;
    // usamos findFirst + create/update manual para cubrir el caso `season = null`.
    const existing = await minutoPrismaClient.oddsTournamentMapping.findFirst({
      where: {
        source: input.source,
        tournamentId: input.tournamentId,
        apifootballSeason: input.apifootballSeason,
      },
    });

    const row = existing
      ? await minutoPrismaClient.oddsTournamentMapping.update({
          where: { id: existing.id },
          data: {
            sportId: input.sportId,
            countryId: input.countryId,
            apifootballLeagueId: input.apifootballLeagueId,
            status: input.status ?? "confirmed",
            confidence: input.confidence ?? null,
            notes: input.notes ?? null,
            verifiedBy: input.verifiedBy ?? null,
          },
        })
      : await minutoPrismaClient.oddsTournamentMapping.create({
          data: {
            source: input.source,
            sportId: input.sportId,
            countryId: input.countryId,
            tournamentId: input.tournamentId,
            apifootballLeagueId: input.apifootballLeagueId,
            apifootballSeason: input.apifootballSeason,
            status: input.status ?? "confirmed",
            confidence: input.confidence ?? null,
            notes: input.notes ?? null,
            verifiedBy: input.verifiedBy ?? null,
          },
        });

    return toRecord(row)!;
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await minutoPrismaClient.oddsTournamentMapping.deleteMany({
      where: { id },
    });
    return result.count > 0;
  }

  async listBySportAndCountry(
    source: OddsSource,
    sportId: number,
    countryId: number
  ): Promise<OddsTournamentMappingRecord[]> {
    const rows = await minutoPrismaClient.oddsTournamentMapping.findMany({
      where: { source, sportId, countryId },
    });
    return rows.map((row) => toRecord(row)!);
  }

  async listAllConfirmed(source: OddsSource): Promise<OddsTournamentMappingRecord[]> {
    const rows = await minutoPrismaClient.oddsTournamentMapping.findMany({
      where: { source, status: "confirmed" },
    });
    return rows.map((row) => toRecord(row)!);
  }
}

export const tournamentMappingRepository =
  new PrismaTournamentMappingRepository();
