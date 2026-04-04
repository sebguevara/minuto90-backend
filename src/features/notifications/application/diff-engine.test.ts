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

  it("uses the score implied by the goal event when provider events arrive before goals snapshot updates", () => {
    const old = fixtureBase({ fixture: { id: 1, status: { short: "1H", elapsed: 39 } } });
    const a = apply(null, old);

    const goalWithStaleScore = fixtureBase({
      fixture: { id: 1, status: { short: "1H", elapsed: 40 } },
      goals: { home: 0, away: 0 },
      teams: { home: { id: 10, name: "Independiente" }, away: { id: 20, name: "Racing Club" } },
      events: [
        {
          type: "Goal",
          detail: "Normal Goal",
          team: { id: 20, name: "Racing Club" },
          player: { name: "Adrian Martinez" },
          assist: { name: "Adrian Martinez" },
          time: { elapsed: 40 },
        },
      ],
    });

    const b = apply(a.state, goalWithStaleScore);
    expect(b.triggers.map((t) => t.type)).toEqual(["GOAL"]);
    expect(b.triggers[0]?.message).toContain("Independiente 0 - 1 Racing Club");
    expect(b.triggers[0]?.message).not.toContain("Independiente 0 - 0 Racing Club");
  });

  it("does not send GOAL notification for missed penalties", () => {
    const old = fixtureBase({
      fixture: { id: 1, status: { short: "1H", elapsed: 64 } },
      teams: { home: { id: 10, name: "Independiente" }, away: { id: 20, name: "Racing Club" } },
    });
    const a = apply(null, old);

    const missedPenalty = fixtureBase({
      fixture: { id: 1, status: { short: "1H", elapsed: 65 } },
      goals: { home: 0, away: 0 },
      teams: { home: { id: 10, name: "Independiente" }, away: { id: 20, name: "Racing Club" } },
      events: [
        {
          type: "Goal",
          detail: "Missed Penalty",
          team: { id: 20, name: "Racing Club" },
          player: { name: "Adrian Martinez" },
          time: { elapsed: 65 },
        },
      ],
    });

    const b = apply(a.state, missedPenalty);
    expect(b.triggers).toHaveLength(0);
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

  it("does not fire GOAL twice when the provider corrects only the minute of the same goal", () => {
    const old = fixtureBase({ fixture: { id: 1, status: { short: "1H", elapsed: 10 } } });
    const a = apply(null, old);

    const goal35 = fixtureBase({
      fixture: { id: 1, status: { short: "1H", elapsed: 36 } },
      goals: { home: 1, away: 0 },
      events: [
        {
          type: "Goal",
          detail: "Normal Goal",
          team: { name: "Southampton" },
          player: { name: "R. Stewart" },
          time: { elapsed: 35 },
        },
      ],
    });
    const b = apply(a.state, goal35);
    expect(b.triggers.map((t) => t.type)).toEqual(["GOAL"]);

    const goal36 = fixtureBase({
      fixture: { id: 1, status: { short: "1H", elapsed: 36 } },
      goals: { home: 1, away: 0 },
      events: [
        {
          type: "Goal",
          detail: "Normal Goal",
          team: { name: "Southampton" },
          player: { name: "R. Stewart" },
          time: { elapsed: 36 },
        },
      ],
    });
    const c = apply(b.state, goal36);
    expect(c.triggers).toHaveLength(0);
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
