import { minutoPrismaClient } from "../../../lib/minuto-client";
import { logWarn } from "../../../shared/logging/logger";
import type { MomentumNarrative, MomentumSignal } from "../application/momentum.types";

export interface StoredMomentumInsight extends MomentumNarrative {
  id: string;
  fixtureId: number;
  minute: number;
  signalType: string;
  team: "home" | "away";
  stats: Record<string, number | string>;
  delta: Record<string, number>;
  probability: number | null;
  createdAt: string;
}

export async function saveMomentumInsight(
  signal: MomentumSignal,
  narrative: MomentumNarrative
): Promise<StoredMomentumInsight | null> {
  try {
    const row = await minutoPrismaClient.matchMomentumInsight.upsert({
      where: {
        fixtureId_signalType_team_minute: {
          fixtureId: signal.fixtureId,
          signalType: signal.signalType,
          team: signal.team,
          minute: signal.minute,
        },
      },
      create: {
        fixtureId: signal.fixtureId,
        minute: signal.minute,
        signalType: signal.signalType,
        team: signal.team,
        narrative: narrative.narrative,
        cardTitle: narrative.cardTitle,
        emoji: narrative.emoji,
        stats: signal.stats as unknown as object,
        delta: signal.delta as unknown as object,
        probability: signal.probability ?? null,
      },
      update: {
        narrative: narrative.narrative,
        cardTitle: narrative.cardTitle,
        emoji: narrative.emoji,
        stats: signal.stats as unknown as object,
        delta: signal.delta as unknown as object,
        probability: signal.probability ?? null,
      },
    });

    return mapRow(row);
  } catch (err: any) {
    logWarn("momentum.persist_failed", {
      fixtureId: signal.fixtureId,
      signalType: signal.signalType,
      err: err?.message ?? String(err),
    });
    return null;
  }
}

export async function listMomentumInsights(fixtureId: number): Promise<StoredMomentumInsight[]> {
  try {
    const rows = await minutoPrismaClient.matchMomentumInsight.findMany({
      where: { fixtureId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(mapRow);
  } catch (err: any) {
    logWarn("momentum.list_failed", {
      fixtureId,
      err: err?.message ?? String(err),
    });
    return [];
  }
}

function mapRow(row: {
  id: string;
  fixtureId: number;
  minute: number;
  signalType: string;
  team: string;
  narrative: string;
  cardTitle: string;
  emoji: string;
  stats: unknown;
  delta: unknown;
  probability: number | null;
  createdAt: Date;
}): StoredMomentumInsight {
  return {
    id: row.id,
    fixtureId: row.fixtureId,
    minute: row.minute,
    signalType: row.signalType,
    team: row.team === "away" ? "away" : "home",
    narrative: row.narrative,
    cardTitle: row.cardTitle,
    emoji: row.emoji,
    stats: (row.stats ?? {}) as Record<string, number | string>,
    delta: (row.delta ?? {}) as Record<string, number>,
    probability: row.probability,
    createdAt: row.createdAt.toISOString(),
  };
}
