import { minutoPrismaClient } from "../../../lib/minuto-client";
import { logError } from "../../../shared/logging/logger";

const db = minutoPrismaClient;

// Lockout: 1 day before first WC 2026 match (June 11, 2026 at 18:00 UTC)
const WC_LOCKOUT_DATE = new Date("2026-06-10T18:00:00Z");

// ─── Types ────────────────────────────────────────────────────────────────────

export type BracketTeam = {
  teamId: number;
  teamName: string;
  teamFlag: string; // logo URL from API Football
};

/** User's prediction for a single group: ordered 1°, 2°, 3°, 4° */
export type BracketGroupPick = {
  first: BracketTeam;
  second: BracketTeam;
  third: BracketTeam;
  fourth: BracketTeam;
};

/** Result prediction for a knockout match (including scoreline) */
export type MatchResult = {
  home: BracketTeam;
  away: BracketTeam;
  homeGoals: number;
  awayGoals: number;
  winner: BracketTeam;
  extraTime?: boolean;
  penalties?: boolean;
};

/** Full bracket prediction */
export type Bracket = {
  /** Group stage picks: key is group label e.g. "Group A" */
  groups?: Record<string, BracketGroupPick>;
  /** IDs of the 8 3rd-place teams the user predicts will qualify */
  thirdPlaceQualifiers?: number[];
  r32?: MatchResult[]; // 16 matches
  r16?: MatchResult[]; // 8 matches
  qf?: MatchResult[]; // 4 matches
  sf?: MatchResult[]; // 2 matches
  thirdPlace?: MatchResult;
  final?: MatchResult;
  champion?: BracketTeam;
  runnerUp?: BracketTeam;
  currentStep?: string;
};

// ─── Scoring ──────────────────────────────────────────────────────────────────

export const SCORING = {
  group: {
    first: 5, // correct 1st place
    second: 5, // correct 2nd place
    third: 3, // correct 3rd place
    fourth: 2, // correct 4th place
    perfectGroup: 5, // all 4 in exact order
  },
  knockout: {
    r32: { winner: 3, exactScore: 2 },
    r16: { winner: 5, exactScore: 3 },
    qf: { winner: 8, exactScore: 4 },
    sf: { winner: 12, exactScore: 5 },
    third: { winner: 8, exactScore: 4 },
    final: { winner: 20, exactScore: 10 },
  },
  penalties: 2, // bonus for correctly predicting it goes to penalties
  thirdPlaceQualifier: 2, // bonus per correct 3rd-place qualifier
} as const;

// Max theoretical score:
// Groups:  12 × (5+5+3+2+5) = 240 pts
// R32:     16 × (3+2)       =  80 pts
// R16:      8 × (5+3)       =  64 pts
// QF:       4 × (8+4)       =  48 pts
// SF:       2 × (12+5)      =  34 pts
// 3rd:      1 × (8+4)       =  12 pts
// Final:    1 × (20+10)     =  30 pts
// 3rd qualifiers: 8 × 2     =  16 pts
// Total max: ~524 pts

function scoreMatch(
  pick: MatchResult | undefined,
  actual: MatchResult | undefined,
  pts: { winner: number; exactScore: number }
): number {
  if (!pick || !actual) return 0;
  let score = 0;
  if (pick.winner.teamId === actual.winner.teamId) {
    score += pts.winner;
    if (pick.homeGoals === actual.homeGoals && pick.awayGoals === actual.awayGoals) {
      score += pts.exactScore;
    }
    if (pick.penalties && actual.penalties) {
      score += SCORING.penalties;
    }
  }
  return score;
}

export function calculateScore(
  userBracket: Bracket,
  actualResults: Bracket
): number {
  let total = 0;

  // ── Groups ─────────────────────────────────────────────────────────────────
  if (userBracket.groups && actualResults.groups) {
    for (const groupLabel of Object.keys(actualResults.groups)) {
      const actual = actualResults.groups[groupLabel];
      const pick = userBracket.groups[groupLabel];
      if (!pick || !actual) continue;

      const positions: Array<keyof BracketGroupPick> = ["first", "second", "third", "fourth"];
      let perfectGroup = true;
      for (const pos of positions) {
        if (pick[pos]?.teamId === actual[pos]?.teamId) {
          total += SCORING.group[pos];
        } else {
          perfectGroup = false;
        }
      }
      if (perfectGroup) total += SCORING.group.perfectGroup;
    }
  }

  // ── 3rd place qualifiers ───────────────────────────────────────────────────
  if (userBracket.thirdPlaceQualifiers && actualResults.thirdPlaceQualifiers) {
    const actualSet = new Set(actualResults.thirdPlaceQualifiers);
    for (const teamId of userBracket.thirdPlaceQualifiers) {
      if (actualSet.has(teamId)) total += SCORING.thirdPlaceQualifier;
    }
  }

  // ── Knockout rounds ────────────────────────────────────────────────────────
  const rounds: Array<{
    key: keyof Pick<Bracket, "r32" | "r16" | "qf" | "sf">;
    pts: { winner: number; exactScore: number };
  }> = [
    { key: "r32", pts: SCORING.knockout.r32 },
    { key: "r16", pts: SCORING.knockout.r16 },
    { key: "qf", pts: SCORING.knockout.qf },
    { key: "sf", pts: SCORING.knockout.sf },
  ];

  for (const { key, pts } of rounds) {
    const actualRound = actualResults[key];
    const pickRound = userBracket[key];
    if (!actualRound || !pickRound) continue;
    for (let i = 0; i < actualRound.length; i++) {
      total += scoreMatch(pickRound[i], actualRound[i], pts);
    }
  }

  total += scoreMatch(userBracket.thirdPlace, actualResults.thirdPlace, SCORING.knockout.third);
  total += scoreMatch(userBracket.final, actualResults.final, SCORING.knockout.final);

  return total;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const mundialPronosticoService = {
  isLocked(): boolean {
    return new Date() >= WC_LOCKOUT_DATE;
  },

  async get(userId: string) {
    return db.mundialPronostico.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, name: true, email: true, imageUrl: true } },
      },
    });
  },

  async save(userId: string, bracket: Bracket) {
    if (this.isLocked()) {
      throw new Error("LOCKED");
    }

    return db.mundialPronostico.upsert({
      where: { userId },
      create: {
        userId,
        bracket: bracket as any,
        score: 0,
      },
      update: {
        bracket: bracket as any,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, name: true, email: true, imageUrl: true } },
      },
    });
  },

  async getRanking(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      db.mundialPronostico.findMany({
        orderBy: [{ score: "desc" }, { updatedAt: "asc" }],
        skip,
        take: limit,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, name: true, email: true, imageUrl: true } },
        },
      }),
      db.mundialPronostico.count(),
    ]);
    return { items, total, page, limit };
  },
};
