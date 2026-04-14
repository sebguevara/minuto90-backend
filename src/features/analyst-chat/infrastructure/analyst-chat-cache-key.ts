import { createHash } from "node:crypto";
import type { AnalystChatIntent, ResolvedEntities } from "../domain/analyst-chat.types";

const ENV = process.env.NODE_ENV ?? "dev";

/** Conversation history (sliding window). */
export function buildConversationCacheKey(clerkId: string) {
  return `minuto90:${ENV}:chat:conv:${clerkId}:v1`;
}

/** Per-user hourly rate limit counter. */
export function buildChatRateLimitKey(clerkId: string) {
  return `minuto90:${ENV}:chat:rate:${clerkId}:v1`;
}

/** Cached LLM response for an intent + entity combo. */
export function buildChatResponseCacheKey(
  intent: AnalystChatIntent,
  entities: ResolvedEntities
) {
  const parts: string[] = [intent];
  if (entities.fixtureId) parts.push(`f:${entities.fixtureId}`);
  if (entities.teamIds?.length)
    parts.push(`t:${[...entities.teamIds].sort().join("-")}`);
  if (entities.leagueId) parts.push(`l:${entities.leagueId}`);
  if (entities.playerName) parts.push(`p:${entities.playerName}`);
  if (entities.date) parts.push(`d:${entities.date}`);

  const hash = createHash("md5").update(parts.join(":")).digest("hex").slice(0, 12);
  return `minuto90:${ENV}:chat:resp:${hash}:v1`;
}

/** Distributed lock for response generation. */
export function buildChatLockKey(cacheKey: string) {
  return `${cacheKey}:lock`;
}
