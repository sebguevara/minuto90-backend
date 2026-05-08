import { describe, expect, it } from "bun:test";

import type { OddsTeamAliasRecord } from "../domain/odds-integration.types";
import type { TeamAliasRepository } from "../infrastructure/team-alias.repository";
import { EventMatcherService } from "./event-matcher.service";

class StubAliasRepo implements TeamAliasRepository {
  constructor(private readonly aliases: OddsTeamAliasRecord[] = []) {}
  async findByNormalizedName(source: "kickertech", sportId: number, normalizedName: string) {
    const match = this.aliases.find(
      (alias) =>
        alias.source === source &&
        alias.sportId === sportId &&
        alias.normalizedName === normalizedName
    );
    return match ?? null;
  }
  async upsert(): Promise<OddsTeamAliasRecord> {
    throw new Error("not used in matcher tests");
  }
  async deleteById(): Promise<boolean> {
    throw new Error("not used in matcher tests");
  }
  async listBySport(): Promise<OddsTeamAliasRecord[]> {
    return [];
  }
}

const baseFixture = {
  fixtureId: 12345,
  date: "2026-05-08T20:00:00.000Z",
  leagueId: 39,
  season: 2025,
  home: { id: 33, name: "Manchester United" },
  away: { id: 50, name: "Manchester City" },
};

describe("EventMatcherService", () => {
  it("acepta match exacto cuando los nombres y la fecha coinciden", async () => {
    const matcher = new EventMatcherService(new StubAliasRepo());
    const result = await matcher.match({
      source: "kickertech",
      sportId: 2,
      fixture: baseFixture,
      candidates: [
        {
          externalEventId: 999,
          home: "Manchester United",
          away: "Manchester City",
          dateStart: "2026-05-08T20:00:00.000Z",
        },
      ],
    });
    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.externalEventId).toBe(999);
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      expect(result.reversed).toBe(false);
    }
  });

  it("acepta cuando hay un alias persistido aunque el string difiera", async () => {
    const aliasRepo = new StubAliasRepo([
      {
        id: "a1",
        source: "kickertech",
        sportId: 2,
        externalName: "Man Utd",
        normalizedName: "man utd",
        apifootballTeamId: 33,
        confidence: 1,
        verifiedBy: null,
      },
      {
        id: "a2",
        source: "kickertech",
        sportId: 2,
        externalName: "Man City",
        normalizedName: "man city",
        apifootballTeamId: 50,
        confidence: 1,
        verifiedBy: null,
      },
    ]);
    const matcher = new EventMatcherService(aliasRepo);

    const result = await matcher.match({
      source: "kickertech",
      sportId: 2,
      fixture: baseFixture,
      candidates: [
        {
          externalEventId: 7,
          home: "Man Utd",
          away: "Man City",
          dateStart: "2026-05-08T20:03:00.000Z",
        },
      ],
    });

    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.externalEventId).toBe(7);
      expect(result.matchedBy).toBe("alias");
    }
  });

  it("rechaza candidatos fuera de la ventana temporal", async () => {
    const matcher = new EventMatcherService(new StubAliasRepo());
    const result = await matcher.match({
      source: "kickertech",
      sportId: 2,
      fixture: baseFixture,
      candidates: [
        {
          externalEventId: 100,
          home: "Manchester United",
          away: "Manchester City",
          dateStart: "2026-05-08T22:00:00.000Z", // 2h después
        },
      ],
    });
    expect(result.matched).toBe(false);
    if (!result.matched) {
      expect(result.reason).toBe("no_candidates_in_time_window");
    }
  });

  it("detecta orden invertido home↔away pero penaliza", async () => {
    const matcher = new EventMatcherService(new StubAliasRepo());
    const result = await matcher.match({
      source: "kickertech",
      sportId: 2,
      fixture: baseFixture,
      candidates: [
        {
          externalEventId: 555,
          home: "Manchester City",
          away: "Manchester United",
          dateStart: "2026-05-08T20:00:00.000Z",
        },
      ],
    });
    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.reversed).toBe(true);
    }
  });

  it("rechaza si los nombres son demasiado distintos aunque coincida la fecha", async () => {
    const matcher = new EventMatcherService(new StubAliasRepo());
    const result = await matcher.match({
      source: "kickertech",
      sportId: 2,
      fixture: baseFixture,
      candidates: [
        {
          externalEventId: 200,
          home: "Real Madrid",
          away: "Barcelona",
          dateStart: "2026-05-08T20:00:00.000Z",
        },
      ],
    });
    expect(result.matched).toBe(false);
    if (!result.matched) {
      expect(result.reason).toBe("below_threshold");
      expect(result.bestConfidence).toBeLessThan(0.85);
    }
  });

  it("devuelve no_candidates si no hay ninguno", async () => {
    const matcher = new EventMatcherService(new StubAliasRepo());
    const result = await matcher.match({
      source: "kickertech",
      sportId: 2,
      fixture: baseFixture,
      candidates: [],
    });
    expect(result.matched).toBe(false);
    if (!result.matched) {
      expect(result.reason).toBe("no_candidates_in_time_window");
    }
  });

  it("elige el mejor candidato cuando hay varios en la ventana", async () => {
    const matcher = new EventMatcherService(new StubAliasRepo());
    const result = await matcher.match({
      source: "kickertech",
      sportId: 2,
      fixture: baseFixture,
      candidates: [
        {
          externalEventId: 1,
          home: "Manchester United Reserves",
          away: "Manchester City Reserves",
          dateStart: "2026-05-08T20:00:00.000Z",
        },
        {
          externalEventId: 2,
          home: "Manchester United",
          away: "Manchester City",
          dateStart: "2026-05-08T20:02:00.000Z",
        },
      ],
    });
    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.externalEventId).toBe(2);
    }
  });
});
