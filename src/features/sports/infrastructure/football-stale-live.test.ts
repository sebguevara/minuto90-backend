import { describe, expect, it } from "bun:test";
import {
  coerceStaleLiveFixture,
  filterOutStaleLive,
  isStaleLiveFixture,
} from "./football-stale-live";

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse("2026-06-02T02:00:00.000Z");

function fixture(opts: {
  id?: number;
  short: string;
  elapsed?: number | null;
  kickoffMsAgo?: number;
  timestamp?: number | null;
  date?: string | null;
}) {
  const kickoff = NOW - (opts.kickoffMsAgo ?? 0);
  return {
    fixture: {
      id: opts.id ?? 1,
      date: opts.date ?? new Date(kickoff).toISOString(),
      timestamp: opts.timestamp ?? Math.floor(kickoff / 1000),
      status: { short: opts.short, long: opts.short, elapsed: opts.elapsed ?? null },
    },
    goals: { home: 2, away: 0 },
  };
}

describe("isStaleLiveFixture", () => {
  it("marks an in-play fixture stuck >4h after kickoff as stale", () => {
    // Reproduce el caso real: Colombia-Costa Rica clavado en 1H minuto 28, kickoff 6h atrás.
    const f = fixture({ short: "1H", elapsed: 28, kickoffMsAgo: 6 * HOUR });
    expect(isStaleLiveFixture(f, NOW)).toBe(true);
  });

  it("does NOT flag a normal live match within the plausible window", () => {
    const f = fixture({ short: "2H", elapsed: 70, kickoffMsAgo: 1.5 * HOUR });
    expect(isStaleLiveFixture(f, NOW)).toBe(false);
  });

  it("ignores already-terminal statuses (FT) regardless of age", () => {
    const f = fixture({ short: "FT", elapsed: 90, kickoffMsAgo: 8 * HOUR });
    expect(isStaleLiveFixture(f, NOW)).toBe(false);
  });

  it("ignores not-started fixtures in the future", () => {
    const f = fixture({ short: "NS", kickoffMsAgo: -2 * HOUR });
    expect(isStaleLiveFixture(f, NOW)).toBe(false);
  });

  it("does NOT coerce SUSP/INT (can legitimately resume)", () => {
    const f = fixture({ short: "SUSP", kickoffMsAgo: 6 * HOUR });
    expect(isStaleLiveFixture(f, NOW)).toBe(false);
  });

  it("falls back to the ISO date when timestamp is missing", () => {
    const f = fixture({ short: "1H", elapsed: 28, kickoffMsAgo: 6 * HOUR, timestamp: null });
    expect(isStaleLiveFixture(f, NOW)).toBe(true);
  });

  it("respects FOOTBALL_STALE_LIVE_MAX_HOURS via explicit maxAgeMs", () => {
    const f = fixture({ short: "1H", elapsed: 28, kickoffMsAgo: 3 * HOUR });
    expect(isStaleLiveFixture(f, NOW, 2 * HOUR)).toBe(true);
    expect(isStaleLiveFixture(f, NOW, 4 * HOUR)).toBe(false);
  });
});

describe("coerceStaleLiveFixture", () => {
  it("rewrites a stale-live fixture to FT and stops the clock", () => {
    const f = fixture({ short: "1H", elapsed: 28, kickoffMsAgo: 6 * HOUR });
    const out = coerceStaleLiveFixture(f, NOW);
    expect(out.fixture.status.short).toBe("FT");
    expect(out.fixture.status.long).toBe("Match Finished");
    expect(out.fixture.status.elapsed).toBeNull();
    // El marcador conocido se preserva.
    expect(out.goals).toEqual({ home: 2, away: 0 });
  });

  it("returns the same object reference when not stale (no needless clone)", () => {
    const f = fixture({ short: "2H", elapsed: 70, kickoffMsAgo: 1 * HOUR });
    expect(coerceStaleLiveFixture(f, NOW)).toBe(f);
  });
});

describe("filterOutStaleLive", () => {
  it("drops only the stale-live fixtures", () => {
    const ghost = fixture({ id: 1537648, short: "1H", elapsed: 28, kickoffMsAgo: 6 * HOUR });
    const real = fixture({ id: 999, short: "2H", elapsed: 60, kickoffMsAgo: 1 * HOUR });
    const out = filterOutStaleLive([ghost, real], NOW);
    expect(out).toEqual([real]);
  });
});
