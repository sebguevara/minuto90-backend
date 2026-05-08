import { minutoPrismaClient } from "../../../lib/minuto-client";
import type {
  OddsSource,
  OddsTeamAliasRecord,
} from "../domain/odds-integration.types";

/**
 * Acceso a los aliases de equipo. Función central del matcher: dado un nombre
 * tal como aparece en Kickertech, devolver el `apifootball_team_id` correspondiente.
 */
export interface TeamAliasRepository {
  findByNormalizedName(
    source: OddsSource,
    sportId: number,
    normalizedName: string
  ): Promise<OddsTeamAliasRecord | null>;

  upsert(input: {
    source: OddsSource;
    sportId: number;
    externalName: string;
    normalizedName: string;
    apifootballTeamId: number;
    confidence?: number;
    verifiedBy?: string | null;
  }): Promise<OddsTeamAliasRecord>;

  deleteById(id: string): Promise<boolean>;

  listBySport(source: OddsSource, sportId: number): Promise<OddsTeamAliasRecord[]>;
}

type Row = Awaited<
  ReturnType<typeof minutoPrismaClient.oddsTeamAlias.findUnique>
>;

const toRecord = (row: NonNullable<Row>): OddsTeamAliasRecord => ({
  id: row.id,
  source: row.source as OddsSource,
  sportId: row.sportId,
  externalName: row.externalName,
  normalizedName: row.normalizedName,
  apifootballTeamId: row.apifootballTeamId,
  confidence: row.confidence,
  verifiedBy: row.verifiedBy,
});

export class PrismaTeamAliasRepository implements TeamAliasRepository {
  async findByNormalizedName(
    source: OddsSource,
    sportId: number,
    normalizedName: string
  ): Promise<OddsTeamAliasRecord | null> {
    if (!normalizedName) return null;
    const row = await minutoPrismaClient.oddsTeamAlias.findUnique({
      where: {
        source_sportId_normalizedName: {
          source,
          sportId,
          normalizedName,
        },
      },
    });
    return row ? toRecord(row) : null;
  }

  async upsert(input: {
    source: OddsSource;
    sportId: number;
    externalName: string;
    normalizedName: string;
    apifootballTeamId: number;
    confidence?: number;
    verifiedBy?: string | null;
  }): Promise<OddsTeamAliasRecord> {
    const row = await minutoPrismaClient.oddsTeamAlias.upsert({
      where: {
        source_sportId_normalizedName: {
          source: input.source,
          sportId: input.sportId,
          normalizedName: input.normalizedName,
        },
      },
      create: {
        source: input.source,
        sportId: input.sportId,
        externalName: input.externalName,
        normalizedName: input.normalizedName,
        apifootballTeamId: input.apifootballTeamId,
        confidence: input.confidence ?? 1,
        verifiedBy: input.verifiedBy ?? null,
      },
      update: {
        externalName: input.externalName,
        apifootballTeamId: input.apifootballTeamId,
        confidence: input.confidence ?? 1,
        verifiedBy: input.verifiedBy ?? null,
      },
    });
    return toRecord(row);
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await minutoPrismaClient.oddsTeamAlias.deleteMany({
      where: { id },
    });
    return result.count > 0;
  }

  async listBySport(
    source: OddsSource,
    sportId: number
  ): Promise<OddsTeamAliasRecord[]> {
    const rows = await minutoPrismaClient.oddsTeamAlias.findMany({
      where: { source, sportId },
      orderBy: { externalName: "asc" },
    });
    return rows.map((row) => toRecord(row));
  }
}

export const teamAliasRepository = new PrismaTeamAliasRepository();
