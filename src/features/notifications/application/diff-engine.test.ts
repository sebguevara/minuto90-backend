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

  it("no envía GOAL por penalti en juego (detail Penalty fuera de tanda)", () => {
    const old = fixtureBase({
      fixture: { id: 1, status: { short: "2H", elapsed: 80 } },
      goals: { home: 0, away: 0 },
      teams: { home: { id: 10, name: "Independiente" }, away: { id: 20, name: "Racing Club" } },
    });
    const a = apply(null, old);

    const penaltyGoal = fixtureBase({
      fixture: { id: 1, status: { short: "2H", elapsed: 82 } },
      goals: { home: 1, away: 0 },
      teams: { home: { id: 10, name: "Independiente" }, away: { id: 20, name: "Racing Club" } },
      events: [
        {
          type: "Goal",
          detail: "Penalty",
          team: { id: 10, name: "Independiente" },
          player: { name: "Delantero" },
          time: { elapsed: 82 },
        },
      ],
    });

    const b = apply(a.state, penaltyGoal);
    expect(b.triggers.filter((t) => t.type === "GOAL")).toHaveLength(0);
  });

  it("dispara inicio de tanda y lanzamiento con plantilla de penales (estado P)", () => {
    const before = fixtureBase({
      fixture: { id: 1, status: { short: "AET", elapsed: 120 } },
      goals: { home: 1, away: 1 },
      teams: { home: { name: "Boca" }, away: { name: "River" } },
      score: { penalty: { home: 0, away: 0 } },
      events: [
        {
          type: "Goal",
          detail: "Normal Goal",
          team: { name: "Boca" },
          player: { name: "A" },
          time: { elapsed: 90 },
        },
        {
          type: "Goal",
          detail: "Normal Goal",
          team: { name: "River" },
          player: { name: "B" },
          time: { elapsed: 115 },
        },
      ],
    });
    const a = apply(null, before);

    const shootout = fixtureBase({
      fixture: { id: 1, status: { short: "P", elapsed: null } },
      goals: { home: 1, away: 1 },
      teams: { home: { name: "Boca" }, away: { name: "River" } },
      score: { penalty: { home: 1, away: 0 } },
      events: [
        ...(before.events ?? []),
        {
          type: "Goal",
          detail: "Penalty",
          team: { name: "Boca" },
          player: { name: "Pateador" },
          time: { elapsed: 121 },
        },
      ],
    });

    const b = apply(a.state, shootout);
    expect(b.triggers.map((t) => t.type)).toEqual(["PENALTY_SHOOTOUT_START", "PENALTY_SHOOTOUT_KICK"]);
    expect(b.triggers[0]?.message).toContain("Empieza la tanda");
    expect(b.triggers[1]?.message).toContain("Penal (tanda)");
    expect(b.triggers[1]?.message).toContain("Serie de penales");
    expect(b.triggers[1]?.message).toContain("1 - 0");
    expect(b.triggers[1]?.message).not.toContain("Boca 1 - 1 River");
  });

  it("en tanda notifica fallo (Missed Penalty) sin usar plantilla de gol normal", () => {
    const inShootout = fixtureBase({
      fixture: { id: 1, status: { short: "P", elapsed: null } },
      goals: { home: 1, away: 1 },
      score: { penalty: { home: 0, away: 0 } },
      events: [
        {
          type: "Goal",
          detail: "Penalty",
          team: { name: "Boca" },
          player: { name: "Uno" },
          time: { elapsed: 121 },
        },
      ],
    });
    const a = apply(null, inShootout);

    const miss = fixtureBase({
      fixture: { id: 1, status: { short: "P", elapsed: null } },
      goals: { home: 1, away: 1 },
      score: { penalty: { home: 0, away: 0 } },
      events: [
        ...(inShootout.events ?? []),
        {
          type: "Goal",
          detail: "Missed Penalty",
          team: { name: "River" },
          player: { name: "Dos" },
          time: { elapsed: 122 },
        },
      ],
    });

    const b = apply(a.state, miss);
    expect(b.triggers.map((t) => t.type)).toEqual(["PENALTY_SHOOTOUT_KICK"]);
    expect(b.triggers[0]?.message).toContain("errado");
    expect(b.triggers.filter((t) => t.type === "GOAL")).toHaveLength(0);
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

  it("does not replay historical goals when events refill but score was already correct (empty old feed)", () => {
    const sparse = fixtureBase({
      fixture: { id: 1, status: { short: "2H", elapsed: 48 } },
      goals: { home: 2, away: 1 },
      teams: { home: { id: 1, name: "Sao Paulo" }, away: { id: 2, name: "Cruzeiro" } },
      events: [],
    });
    const a = apply(null, sparse);
    expect(a.triggers.map((t) => t.type)).toEqual([]);

    const fullFeed = fixtureBase({
      fixture: { id: 1, status: { short: "2H", elapsed: 48 } },
      goals: { home: 2, away: 1 },
      teams: { home: { id: 1, name: "Sao Paulo" }, away: { id: 2, name: "Cruzeiro" } },
      events: [
        { type: "Goal", team: { id: 1, name: "Sao Paulo" }, player: { name: "A" }, time: { elapsed: 12 } },
        { type: "Goal", team: { id: 1, name: "Sao Paulo" }, player: { name: "B" }, time: { elapsed: 16 } },
        {
          type: "Goal",
          team: { id: 2, name: "Cruzeiro" },
          player: { name: "C" },
          time: { elapsed: 47 },
        },
      ],
    });
    const b = apply(a.state, fullFeed);
    expect(b.triggers).toHaveLength(0);
  });

  it("muestra el marcador del snapshot de la API en un gol nuevo (evita desvíos del bump encadenado)", () => {
    const afterFirst = fixtureBase({
      fixture: { id: 1, status: { short: "2H", elapsed: 56 } },
      goals: { home: 1, away: 1 },
      teams: { home: { id: 100, name: "Valencia" }, away: { id: 200, name: "Celta Vigo" } },
      events: [
        {
          type: "Goal",
          detail: "Normal Goal",
          team: { id: 200, name: "Celta Vigo" },
          player: { name: "I. Moriba" },
          time: { elapsed: 56 },
        },
      ],
    });
    const a = apply(null, afterFirst);

    const afterSecond = fixtureBase({
      fixture: { id: 1, status: { short: "2H", elapsed: 60 } },
      goals: { home: 1, away: 2 },
      teams: { home: { id: 100, name: "Valencia" }, away: { id: 200, name: "Celta Vigo" } },
      events: [
        {
          type: "Goal",
          detail: "Normal Goal",
          team: { id: 200, name: "Celta Vigo" },
          player: { name: "I. Moriba" },
          time: { elapsed: 56 },
        },
        {
          type: "Goal",
          detail: "Normal Goal",
          team: { id: 200, name: "Celta Vigo" },
          player: { name: "F. Lopez" },
          time: { elapsed: 60 },
        },
      ],
    });
    const b = apply(a.state, afterSecond);
    expect(b.triggers.map((t) => t.type)).toEqual(["GOAL"]);
    expect(b.triggers[0]?.message).toContain("Valencia 1 - 2 Celta Vigo");
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

  it("dispara VAR_CANCELLED cuando el marcador baja exactamente 1 gol sin evento VAR explícito (heurística)", () => {
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
    expect(b.triggers[0]?.message).toContain("Boca 0 - 0 River");
  });

  it("dispara VAR_CANCELLED cuando la API añade evento de anulación (VAR)", () => {
    const was = fixtureBase({
      fixture: { id: 1, status: { short: "1H", elapsed: 30 } },
      goals: { home: 1, away: 0 },
      events: [
        { type: "Goal", team: { name: "Boca" }, player: { name: "X" }, time: { elapsed: 28 } },
      ],
    });
    const a = apply(null, was);

    const now = fixtureBase({
      fixture: { id: 1, status: { short: "1H", elapsed: 33 } },
      goals: { home: 0, away: 0 },
      events: [
        { type: "Goal", team: { name: "Boca" }, player: { name: "X" }, time: { elapsed: 28 } },
        {
          type: "Var",
          detail: "Goal cancelled",
          team: { name: "Boca" },
          time: { elapsed: 32 },
        },
      ],
    });
    const b = apply(a.state, now);
    expect(b.triggers.map((t) => t.type)).toEqual(["VAR_CANCELLED"]);
  });

  it("dispara el segundo GOAL cuando el mismo jugador anota de nuevo tras un VAR (misma transición de marcador)", () => {
    const old = fixtureBase({ fixture: { id: 1, status: { short: "1H", elapsed: 10 } } });
    const a = apply(null, old);

    // Primera vez: Cavani anota → 1-0
    const firstGoal = fixtureBase({
      fixture: { id: 1, status: { short: "1H", elapsed: 30 } },
      goals: { home: 1, away: 0 },
      events: [
        {
          type: "Goal",
          detail: "Normal Goal",
          team: { name: "Boca" },
          player: { name: "Cavani" },
          time: { elapsed: 30 },
        },
      ],
    });
    const b = apply(a.state, firstGoal);
    expect(b.triggers.map((t) => t.type)).toEqual(["GOAL"]);
    const firstKey = b.triggers[0]?.eventKey;

    // VAR anula el gol → marcador vuelve a 0-0
    const afterVar = fixtureBase({
      fixture: { id: 1, status: { short: "1H", elapsed: 35 } },
      goals: { home: 0, away: 0 },
      events: [
        {
          type: "Goal",
          detail: "Normal Goal",
          team: { name: "Boca" },
          player: { name: "Cavani" },
          time: { elapsed: 30 },
        },
        { type: "Var", detail: "Goal cancelled", team: { name: "Boca" }, time: { elapsed: 34 } },
      ],
    });
    const c = apply(b.state, afterVar);
    expect(c.triggers.map((t) => t.type)).toEqual(["VAR_CANCELLED"]);

    // Cavani anota de nuevo → 1-0 otra vez (misma transición 0-0→1-0)
    const secondGoal = fixtureBase({
      fixture: { id: 1, status: { short: "1H", elapsed: 42 } },
      goals: { home: 1, away: 0 },
      events: [
        {
          type: "Goal",
          detail: "Normal Goal",
          team: { name: "Boca" },
          player: { name: "Cavani" },
          time: { elapsed: 30 },
        },
        { type: "Var", detail: "Goal cancelled", team: { name: "Boca" }, time: { elapsed: 34 } },
        {
          type: "Goal",
          detail: "Normal Goal",
          team: { name: "Boca" },
          player: { name: "Cavani" },
          time: { elapsed: 42 },
        },
      ],
    });
    const d = apply(c.state, secondGoal);
    expect(d.triggers.map((t) => t.type)).toEqual(["GOAL"]);
    // La clave del segundo gol debe ser distinta a la del primero (nth:2 vs nth:1)
    expect(d.triggers[0]?.eventKey).not.toBe(firstKey);
    expect(d.triggers[0]?.eventKey).toContain("goal:");
    expect(d.triggers[0]?.message).toContain("Boca 1 - 0 River");
  });

  it("no dispara VAR doble cuando ya hay evento VAR explícito en la API (score drop + evento)", () => {
    const was = fixtureBase({
      fixture: { id: 1, status: { short: "1H", elapsed: 30 } },
      goals: { home: 1, away: 0 },
      events: [
        { type: "Goal", team: { name: "Boca" }, player: { name: "X" }, time: { elapsed: 28 } },
      ],
    });
    const a = apply(null, was);

    // La API baja el marcador Y añade evento VAR al mismo tiempo
    const now = fixtureBase({
      fixture: { id: 1, status: { short: "1H", elapsed: 33 } },
      goals: { home: 0, away: 0 },
      events: [
        { type: "Goal", team: { name: "Boca" }, player: { name: "X" }, time: { elapsed: 28 } },
        { type: "Var", detail: "Goal cancelled", team: { name: "Boca" }, time: { elapsed: 32 } },
      ],
    });
    const b = apply(a.state, now);
    // Solo debe haber UN trigger VAR (el explícito, no el de score drop)
    expect(b.triggers.filter((t) => t.type === "VAR_CANCELLED")).toHaveLength(1);
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
