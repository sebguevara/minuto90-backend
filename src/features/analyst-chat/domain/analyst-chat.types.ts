// ── Intent enum ──────────────────────────────────────────────────────────────

export const ANALYST_CHAT_INTENTS = [
  "MATCH_DAY",
  "MATCH_PREVIEW",
  "MATCH_LIVE",
  "MATCH_RESULT",
  "STANDINGS",
  "TEAM_FORM",
  "TEAM_STATS",
  "PLAYER_STATS",
  "HEAD_TO_HEAD",
  "TOP_SCORERS",
  "PREDICTIONS",
  "INJURIES",
  "TRANSFERS",
  "GENERAL",
] as const;

export type AnalystChatIntent = (typeof ANALYST_CHAT_INTENTS)[number];

// ── Entities ─────────────────────────────────────────────────────────────────

export type ResolvedEntities = {
  teamIds?: number[];
  leagueId?: number;
  season?: number;
  fixtureId?: number;
  playerName?: string;
  date?: string; // YYYY-MM-DD
};

// ── Conversation ─────────────────────────────────────────────────────────────

export type ConversationTurn = {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  intent?: AnalystChatIntent;
  entities?: ResolvedEntities;
};

export type ConversationState = {
  id: string;
  clerkId: string;
  turns: ConversationTurn[];
  lastEntityContext: ResolvedEntities;
};

// ── Classification ───────────────────────────────────────────────────────────

export type ClassifiedIntent = {
  intent: AnalystChatIntent;
  confidence: number; // 0-1
  entities: ResolvedEntities;
  rawQuery: string;
};

// ── Chat request / response ──────────────────────────────────────────────────

export type ChatRequest = {
  message: string;
  clerkId: string;
  conversationId?: string;
};

export type ChatResponseMeta = {
  tokensIn: number;
  tokensOut: number;
  model: string;
  latencyMs: number;
  cacheHit: boolean;
};

export type ChatResponse = {
  conversationId: string;
  response: string;
  intent: AnalystChatIntent;
  meta: ChatResponseMeta;
};

// ── Rate limit ───────────────────────────────────────────────────────────────

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number; // unix ms
};
