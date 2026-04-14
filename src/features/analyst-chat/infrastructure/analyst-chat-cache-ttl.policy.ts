import type { AnalystChatIntent } from "../domain/analyst-chat.types";

/** TTL in seconds for a cached LLM response, keyed by intent. */
export function getChatResponseTtlSeconds(intent: AnalystChatIntent): number {
  switch (intent) {
    case "MATCH_LIVE":
      return 60; // 1 min — data changes every few seconds
    case "MATCH_PREVIEW":
    case "PREDICTIONS":
      return 5 * 60; // 5 min — pre-match data is fairly stable
    case "MATCH_RESULT":
      return 24 * 60 * 60; // 24 h — results don't change
    case "STANDINGS":
      return 30 * 60; // 30 min — updates after matches finish
    case "TEAM_FORM":
    case "TEAM_STATS":
      return 4 * 60 * 60; // 4 h — same as WS match-profile cache
    case "PLAYER_STATS":
      return 4 * 60 * 60;
    case "HEAD_TO_HEAD":
      return 24 * 60 * 60; // historical, rarely changes
    case "TOP_SCORERS":
      return 30 * 60;
    case "INJURIES":
      return 60 * 60; // 1 h
    case "TRANSFERS":
      return 6 * 60 * 60; // 6 h
    case "GENERAL":
      return 60 * 60; // 1 h
    default:
      return 10 * 60;
  }
}

/** TTL for conversation history (sliding window). */
export const CONVERSATION_TTL_SECONDS = 30 * 60; // 30 min

/** Maximum messages kept in a conversation (3 user + 3 assistant). */
export const MAX_CONVERSATION_TURNS = 6;
