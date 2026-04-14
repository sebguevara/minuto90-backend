import { randomUUID } from "node:crypto";
import { redisConnection } from "../../../shared/redis/redis.connection";
import { logWarn } from "../../../shared/logging/logger";
import { buildConversationCacheKey } from "../infrastructure/analyst-chat-cache-key";
import {
  CONVERSATION_TTL_SECONDS,
  MAX_CONVERSATION_TURNS,
} from "../infrastructure/analyst-chat-cache-ttl.policy";
import type {
  ConversationState,
  ConversationTurn,
} from "../domain/analyst-chat.types";

const EMPTY_STATE = (clerkId: string): ConversationState => ({
  id: randomUUID(),
  clerkId,
  turns: [],
  lastEntityContext: {},
});

/** Load conversation from Redis (or create a new one). */
export async function loadConversation(
  clerkId: string,
  conversationId?: string
): Promise<ConversationState> {
  const key = buildConversationCacheKey(clerkId);
  try {
    const raw = await redisConnection.get(key);
    if (raw) {
      const state = JSON.parse(raw) as ConversationState;
      // If a specific conversationId was requested and doesn't match, start fresh
      if (conversationId && state.id !== conversationId) {
        return EMPTY_STATE(clerkId);
      }
      // Refresh TTL (sliding window)
      await redisConnection.expire(key, CONVERSATION_TTL_SECONDS);
      return state;
    }
  } catch (err) {
    logWarn("analyst_chat.conversation.load_failed", {
      clerkId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return EMPTY_STATE(clerkId);
}

/** Append a turn and persist to Redis with sliding TTL. */
export async function appendTurn(
  state: ConversationState,
  turn: ConversationTurn
): Promise<ConversationState> {
  const updated: ConversationState = {
    ...state,
    turns: [...state.turns, turn].slice(-MAX_CONVERSATION_TURNS),
    lastEntityContext: turn.entities ?? state.lastEntityContext,
  };

  const key = buildConversationCacheKey(state.clerkId);
  try {
    await redisConnection.set(
      key,
      JSON.stringify(updated),
      "EX",
      CONVERSATION_TTL_SECONDS
    );
  } catch (err) {
    logWarn("analyst_chat.conversation.save_failed", {
      clerkId: state.clerkId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return updated;
}

/** Delete conversation from Redis. */
export async function clearConversation(clerkId: string): Promise<void> {
  const key = buildConversationCacheKey(clerkId);
  try {
    await redisConnection.del(key);
  } catch (err) {
    logWarn("analyst_chat.conversation.clear_failed", {
      clerkId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Format conversation history for LLM input (plain text, compact). */
export function formatHistoryForLLM(turns: ConversationTurn[]): string {
  if (turns.length === 0) return "";

  const lines = turns.map((t) => {
    const role = t.role === "user" ? "usuario" : "analista";
    // Trim long messages to ~200 chars to save tokens
    const content =
      t.content.length > 200 ? t.content.slice(0, 200) + "..." : t.content;
    return `- ${role}: ${content}`;
  });

  return `historial_conversacion:\n${lines.join("\n")}`;
}
