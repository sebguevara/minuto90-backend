import { describe, expect, it } from "bun:test";
import { computeDiffTriggers, type StoredMatchState } from "./diff-engine";
import type { ApiFootballLiveFixture } from "../infrastructure/api-football-live.client";

function fixtureBase(overrides: Partial<ApiFootballLiveFixture>): ApiFootballLiveFixture {
  return {
    fixture: { id: 1, status: { short: "NS", elapsed: null } },
    league: { name: "Liga X" },
    teams: { home: { name: "Boca" }, away: { name: "River" } },
    goals: { home: 0, away: 0 },
    events: [],
    ...overrides,
  };
}

function apply(oldState: StoredMatchState | null, f: ApiFootballLiveFixture) {
  const out = computeDiffTriggers(oldState, f);
  return { ...out, state: out.newState };
}

describe("diff-engine", () => {
  it("fires KICKOFF only once", () => {
    const f1 = fixtureBase({ fixture: { id: 1, status: { short: "1H", elapsed: 1 } } });
    const a = apply(null, f1);
    expect(a.triggers.map((t) => t.type)).toEqual(["KICKOFF"]);

    const b = apply(a.state, f1);
    expect(b.triggers).toHaveLength(0);
  });

  it("fires GOAL only once per score change", () => {
    const old = fixtureBase({ fixture: { id: 1, status: { short: "1H", elapsed: 10 } } });
    const a = apply(null, old);

    const goal = fixtureBase({
      fixture: { id: 1, status: { short: "1H", elapsed: 12 } },
      goals: { home: 1, away: 0 },
      events: [{ type: "Goal", team: { name: "Boca" }, player: { name: "Cavani" }, time: { elapsed: 12 } }],
    });
    const b = apply(a.state, goal);
    expect(b.triggers.map((t) => t.type)).toEqual(["GOAL"]);

    const c = apply(b.state, goal);
    expect(c.triggers).toHaveLength(0);
  });

  it("waits to fire GOAL until scorer is present (avoids duplicates)", () => {
    const old = fixtureBase({ fixture: { id: 1, status: { short: "1H", elapsed: 10 } } });
    const a = apply(null, old);

    const goalWithoutPlayer = fixtureBase({
      fixture: { id: 1, status: { short: "1H", elapsed: 31 } },
      goals: { home: 1, away: 0 },
      events: [{ type: "Goal", team: { name: "Boca" }, time: { elapsed: 31 } }],
    });
    const b = apply(a.state, goalWithoutPlayer);
    expect(b.triggers).toHaveLength(0);

    const goalWithPlayer = fixtureBase({
      fixture: { id: 1, status: { short: "1H", elapsed: 31 } },
      goals: { home: 1, away: 0 },
      events: [{ type: "Goal", team: { name: "Boca" }, player: { name: "Cavani" }, time: { elapsed: 31 } }],
    });
    const c = apply(b.state, goalWithPlayer);
    expect(c.triggers.map((t) => t.type)).toEqual(["GOAL"]);

    const d = apply(c.state, goalWithPlayer);
    expect(d.triggers).toHaveLength(0);
  });

  it("does not fire GOAL twice when the provider only adds comments to the same goal event", () => {
    const old = fixtureBase({ fixture: { id: 1, status: { short: "1H", elapsed: 10 } } });
    const a = apply(null, old);

    const goalV1 = fixtureBase({
      fixture: { id: 1, status: { short: "1H", elapsed: 42 } },
      goals: { home: 1, away: 0 },
      events: [
        {
          type: "Goal",
          detail: "Normal Goal",
          team: { name: "Mallorca" },
          player: { name: "M. Morlanes" },
          time: { elapsed: 42 },
        },
      ],
    });
    const b = apply(a.state, goalV1);
    expect(b.triggers.map((t) => t.type)).toEqual(["GOAL"]);

    const goalV2 = fixtureBase({
      fixture: { id: 1, status: { short: "1H", elapsed: 42 } },
      goals: { home: 1, away: 0 },
      events: [
        {
          type: "Goal",
          detail: "Normal Goal",
          team: { name: "Mallorca" },
          player: { name: "M. Morlanes" },
          time: { elapsed: 42 },
          comments: "API added comment later",
        },
      ],
    });
    const c = apply(b.state, goalV2);
    expect(c.triggers).toHaveLength(0);
  });

  it("fires multiple GOAL triggers when multiple new goal events appear in one poll", () => {
    const old = fixtureBase({ fixture: { id: 1, status: { short: "1H", elapsed: 10 } } });
    const a = apply(null, old);

    const twoGoals = fixtureBase({
      fixture: { id: 1, status: { short: "1H", elapsed: 15 } },
      goals: { home: 2, away: 0 },
      events: [
        { type: "Goal", team: { name: "Boca" }, player: { name: "Jugador 1" }, time: { elapsed: 11 } },
        { type: "Goal", team: { name: "Boca" }, player: { name: "Jugador 2" }, time: { elapsed: 15 } },
      ],
    });
    const b = apply(a.state, twoGoals);
    expect(b.triggers.map((t) => t.type)).toEqual(["GOAL", "GOAL"]);

    const c = apply(b.state, twoGoals);
    expect(c.triggers).toHaveLength(0);
  });

  it("fires VAR_CANCELLED when score decreases", () => {
    const was = fixtureBase({
      fixture: { id: 1, status: { short: "1H", elapsed: 30 } },
      goals: { home: 1, away: 0 },
    });
    const a = apply(null, was);

    const now = fixtureBase({
      fixture: { id: 1, status: { short: "1H", elapsed: 32 } },
      goals: { home: 0, away: 0 },
    });
    const b = apply(a.state, now);
    expect(b.triggers.map((t) => t.type)).toEqual(["VAR_CANCELLED"]);
  });

  it("does not fire RED_CARD twice when the provider only adds comments to the same card event", () => {
    const was = fixtureBase({ fixture: { id: 1, status: { short: "1H", elapsed: 50 } } });
    const a = apply(null, was);

    const cardV1 = fixtureBase({
      fixture: { id: 1, status: { short: "1H", elapsed: 55 } },
      events: [
        {
          type: "Card",
          detail: "Red Card",
          team: { name: "River" },
          player: { name: "Jugador X" },
          time: { elapsed: 55 },
        },
      ],
    });
    const b = apply(a.state, cardV1);
    expect(b.triggers.map((t) => t.type)).toEqual(["RED_CARD"]);

    const cardV2 = fixtureBase({
      fixture: { id: 1, status: { short: "1H", elapsed: 55 } },
      events: [
        {
          type: "Card",
          detail: "Red Card",
          team: { name: "River" },
          player: { name: "Jugador X" },
          time: { elapsed: 55 },
          comments: "VAR check",
        },
      ],
    });
    const c = apply(b.state, cardV2);
    expect(c.triggers).toHaveLength(0);
  });

  it("fires RED_CARD when red card count increases", () => {
    const was = fixtureBase({ fixture: { id: 1, status: { short: "1H", elapsed: 50 } } });
    const a = apply(null, was);

    const now = fixtureBase({
      fixture: { id: 1, status: { short: "1H", elapsed: 55 } },
      events: [{ type: "Card", detail: "Red Card", team: { name: "River" }, player: { name: "Jugador X" }, time: { elapsed: 55 } }],
    });
    const b = apply(a.state, now);
    expect(b.triggers.map((t) => t.type)).toEqual(["RED_CARD"]);

    const c = apply(b.state, now);
    expect(c.triggers).toHaveLength(0);
  });

  it("fires HALFTIME, SECOND_HALF and FULL_TIME transitions", () => {
    const h1 = fixtureBase({ fixture: { id: 1, status: { short: "1H", elapsed: 1 } } });
    const a = apply(null, h1);

    const ht = fixtureBase({ fixture: { id: 1, status: { short: "HT", elapsed: 45 } } });
    const b = apply(a.state, ht);
    expect(b.triggers.map((t) => t.type)).toEqual(["HALFTIME"]);

    const h2 = fixtureBase({ fixture: { id: 1, status: { short: "2H", elapsed: 46 } } });
    const c = apply(b.state, h2);
    expect(c.triggers.map((t) => t.type)).toEqual(["SECOND_HALF"]);

    const ft = fixtureBase({ fixture: { id: 1, status: { short: "FT", elapsed: 90 } } });
    const d = apply(c.state, ft);
    expect(d.triggers.map((t) => t.type)).toEqual(["FULL_TIME"]);
  });

  it("does not fire FULL_TIME during halftime glitches", () => {
    const ht = fixtureBase({ fixture: { id: 1, status: { short: "HT", elapsed: 45 } } });
    const a = apply(null, ht);
    expect(a.triggers).toHaveLength(0);

    const ftGlitch = fixtureBase({ fixture: { id: 1, status: { short: "FT", elapsed: 45 } } });
    const b = apply(a.state, ftGlitch);
    expect(b.triggers.map((t) => t.type)).toEqual([]);
  });
});
