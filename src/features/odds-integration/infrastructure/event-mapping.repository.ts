import { minutoPrismaClient } from "../../../lib/minuto-client";
import type {
  OddsEventMappingRecord,
  OddsSource,
} from "../domain/odds-integration.types";

/**
 * Persistencia del mapping evento↔fixture, completado por el matcher automático.
 * Vencido por `expiresAt` (ej: kickoff + 4h) — pasada esa fecha, ignorar y reintentar.
 */
export interface EventMappingRepository {
  findByFixtureId(
    source: OddsSource,
    apifootballFixtureId: number
  ): Promise<OddsEventMappingRecord | null>;
  upsert(input: {
    source: OddsSource;
    sportId: number;
    externalEventId: number;
    apifootballFixtureId: number;
    matchDate: Date;
    confidence: number;
    matchedBy: OddsEventMappingRecord["matchedBy"];
    expiresAt: Date;
  }): Promise<OddsEventMappingRecord>;
}

type Row = Awaited<
  ReturnType<typeof minutoPrismaClient.oddsEventMapping.findFirst>
>;

const toRecord = (row: NonNullable<Row>): OddsEventMappingRecord => ({
  id: row.id,
  source: row.source as OddsSource,
  sportId: row.sportId,
  externalEventId: row.externalEventId,
  apifootballFixtureId: row.apifootballFixtureId,
  matchDate: row.matchDate,
  confidence: row.confidence,
  status: row.status as OddsEventMappingRecord["status"],
  matchedBy: row.matchedBy as OddsEventMappingRecord["matchedBy"],
  expiresAt: row.expiresAt,
});

export class PrismaEventMappingRepository implements EventMappingRepository {
  async findByFixtureId(source: OddsSource, apifootballFixtureId: number) {
    const row = await minutoPrismaClient.oddsEventMapping.findUnique({
      where: {
        source_apifootballFixtureId: { source, apifootballFixtureId },
      },
    });
    if (!row) return null;
    if (row.expiresAt.getTime() <= Date.now()) {
      // Mapping expirado: comportarse como si no existiera (no eliminar acá; el worker lo limpia).
      return null;
    }
    return toRecord(row);
  }

  async upsert(input: {
    source: OddsSource;
    sportId: number;
    externalEventId: number;
    apifootballFixtureId: number;
    matchDate: Date;
    confidence: number;
    matchedBy: OddsEventMappingRecord["matchedBy"];
    expiresAt: Date;
  }) {
    const row = await minutoPrismaClient.oddsEventMapping.upsert({
      where: {
        source_apifootballFixtureId: {
          source: input.source,
          apifootballFixtureId: input.apifootballFixtureId,
        },
      },
      create: {
        source: input.source,
        sportId: input.sportId,
        externalEventId: input.externalEventId,
        apifootballFixtureId: input.apifootballFixtureId,
        matchDate: input.matchDate,
        confidence: input.confidence,
        matchedBy: input.matchedBy,
        expiresAt: input.expiresAt,
      },
      update: {
        externalEventId: input.externalEventId,
        sportId: input.sportId,
        matchDate: input.matchDate,
        confidence: input.confidence,
        matchedBy: input.matchedBy,
        expiresAt: input.expiresAt,
        status: "auto",
      },
    });
    return toRecord(row);
  }
}

export const eventMappingRepository = new PrismaEventMappingRepository();
