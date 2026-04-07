import { minutoPrismaClient } from "../../../lib/minuto-client";
import { logError } from "../../../shared/logging/logger";

const db = minutoPrismaClient;

// Lockout: 1 day before first WC 2026 match (June 11, 2026 at 18:00 UTC)
const WC_LOCKOUT_DATE = new Date("2026-06-10T18:00:00Z");

export type BracketTeam = {
  teamId: number;
  teamName: string;
  teamFlag: string;
};

export type BracketGroupPick = {
  first: BracketTeam;
  second: BracketTeam;
};

export type BracketMatchPick = {
  home: BracketTeam;
  away: BracketTeam;
  winner: BracketTeam;
};

export type Bracket = {
  champion?: BracketTeam;
  runnerUp?: BracketTeam;
  thirdPlace?: BracketTeam;
  groups?: Record<string, BracketGroupPick>;
  r32?: BracketMatchPick[];
  r16?: BracketMatchPick[];
  qf?: BracketMatchPick[];
  sf?: BracketMatchPick[];
  final?: BracketMatchPick;
};

export const mundialPronosticoService = {
  isLocked(): boolean {
    return new Date() >= WC_LOCKOUT_DATE;
  },

  async get(userId: string) {
    return db.mundialPronostico.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, name: true, imageUrl: true } },
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
        user: { select: { id: true, name: true, imageUrl: true } },
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
          user: { select: { id: true, name: true, imageUrl: true } },
        },
      }),
      db.mundialPronostico.count(),
    ]);
    return { items, total, page, limit };
  },
};
