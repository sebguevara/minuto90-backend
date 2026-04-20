import { describe, expect, it } from "bun:test";
import {
  buildFixtureStatsPeriodsResponse,
  createEmptyFixtureStatsPeriodStore,
  getSnapshotIdsToCaptureForStatus,
  subtractTeamStats,
  type FootballFixtureStatsPeriodStore,
  type TeamStatSnapshot,
} from "./fixture-stats-periods.logic";

function team(teamId: number, teamName: string, stats: Record<string, string | number | null>): TeamStatSnapshot {
  return {
    teamId,
    teamName,
    statistics: Object.entries(stats).map(([type, value]) => ({ type, value })),
  };
}

function value(periodTeam: TeamStatSnapshot, type: string) {
  return periodTeam.statistics.find((stat) => stat.type === type)?.value;
}

function storeWith(
  snapshots: FootballFixtureStatsPeriodStore["snapshots"],
  status: string | null = null,
  elapsed: number | null = null
): FootballFixtureStatsPeriodStore {
  return {
    ...createEmptyFixtureStatsPeriodStore(1),
    lastStatusShort: status,
    lastElapsed: elapsed,
    snapshots,
  };
}

describe("fixture stats periods logic", () => {
  it("subtracts cumulative snapshots by team id and stat type", () => {
    const halfTime = [
      team(20, "Away", { "Total Shots": 1 }),
      team(10, "Home", { "Total Shots": 4 }),
    ];
    const fullTime = [
      team(10, "Home", { "Total Shots": 10 }),
      team(20, "Away", { "Total Shots": 6 }),
    ];

    const secondHalf = subtractTeamStats(halfTime, fullTime);

    expect(secondHalf.map((t) => t.teamId)).toEqual([10, 20]);
    expect(value(secondHalf[0], "Total Shots")).toBe(6);
    expect(value(secondHalf[1], "Total Shots")).toBe(5);
  });

  it("recomputes Passes % and does not derive Ball Possession", () => {
    const start = [
      team(10, "Home", {
        "Total passes": 50,
        "Passes accurate": 40,
        "Passes %": "80%",
        "Ball Possession": "60%",
      }),
    ];
    const end = [
      team(10, "Home", {
        "Total passes": 150,
        "Passes accurate": 120,
        "Passes %": "80%",
        "Ball Possession": "55%",
      }),
    ];

    const [period] = subtractTeamStats(start, end);

    expect(value(period, "Total passes")).toBe(100);
    expect(value(period, "Passes accurate")).toBe(80);
    expect(value(period, "Passes %")).toBe(80);
    expect(value(period, "Ball Possession")).toBeNull();
  });

  it("builds first half and live second half before full time", () => {
    const firstHalf = [team(10, "Home", { "Total Shots": 4 }), team(20, "Away", { "Total Shots": 2 })];
    const current = [team(10, "Home", { "Total Shots": 7 }), team(20, "Away", { "Total Shots": 5 })];
    const store = storeWith({ "first-half-end": firstHalf }, "2H", 70);

    const response = buildFixtureStatsPeriodsResponse(store, current);

    expect(response.periods.map((period) => [period.id, period.status])).toEqual([
      ["first-half", "complete"],
      ["second-half", "partial"],
    ]);
    expect(value(response.periods[1].teams[0], "Total Shots")).toBe(3);
    expect(value(response.periods[1].teams[1], "Total Shots")).toBe(3);
  });

  it("builds normal finished match periods", () => {
    const firstHalf = [team(10, "Home", { "Total Shots": 4 })];
    const fullTime = [team(10, "Home", { "Total Shots": 10 })];
    const store = storeWith({ "first-half-end": firstHalf, "full-time-end": fullTime }, "FT", 90);

    const response = buildFixtureStatsPeriodsResponse(store, fullTime);

    expect(response.periods.map((period) => [period.id, period.status])).toEqual([
      ["first-half", "complete"],
      ["second-half", "complete"],
    ]);
    expect(value(response.periods[1].teams[0], "Total Shots")).toBe(6);
  });

  it("builds extra-time periods in chronological order", () => {
    const firstHalf = [team(10, "Home", { "Total Shots": 4 })];
    const fullTime = [team(10, "Home", { "Total Shots": 10 })];
    const extraFirstHalf = [team(10, "Home", { "Total Shots": 12 })];
    const final = [team(10, "Home", { "Total Shots": 15 })];
    const store = storeWith(
      {
        "first-half-end": firstHalf,
        "full-time-end": fullTime,
        "extra-first-half-end": extraFirstHalf,
        final,
      },
      "AET",
      120
    );

    const response = buildFixtureStatsPeriodsResponse(store, final);

    expect(response.periods.map((period) => period.id)).toEqual([
      "first-half",
      "second-half",
      "extra-first-half",
      "extra-second-half",
    ]);
    expect(response.periods.map((period) => value(period.teams[0], "Total Shots"))).toEqual([4, 6, 2, 3]);
  });

  it("does not recapture an existing cut snapshot", () => {
    const empty = createEmptyFixtureStatsPeriodStore(1);
    expect(getSnapshotIdsToCaptureForStatus(empty, "HT")).toEqual(["first-half-end"]);

    const withHalftime = storeWith({ "first-half-end": [team(10, "Home", { "Total Shots": 4 })] }, "HT", 45);
    expect(getSnapshotIdsToCaptureForStatus(withHalftime, "HT")).toEqual([]);

    const withExtraBreak = storeWith(
      {
        "first-half-end": [team(10, "Home", { "Total Shots": 4 })],
        "full-time-end": [team(10, "Home", { "Total Shots": 10 })],
        "extra-first-half-end": [team(10, "Home", { "Total Shots": 12 })],
      },
      "BT",
      105
    );
    expect(getSnapshotIdsToCaptureForStatus(withExtraBreak, "BT")).toEqual([]);
  });
});
