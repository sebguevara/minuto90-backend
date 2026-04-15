import { logInfo } from "../../../shared/logging/logger";
import { redisConnection } from "../../../shared/redis/redis.connection";
import { openai } from "../../insights/infrastructure/openai.client";
import { redisInsightsCacheStore } from "../../insights/infrastructure/insights-cache.store";
import {
  buildChatRateLimitKey,
  buildChatResponseCacheKey,
  buildChatLockKey,
} from "../infrastructure/analyst-chat-cache-key";
import { getChatResponseTtlSeconds } from "../infrastructure/analyst-chat-cache-ttl.policy";
import { buildSystemPrompt } from "../infrastructure/analyst-chat.prompts";
import { classifyIntent } from "./intent-classifier";
import { assembleContext } from "./context-assembler";
import {
  loadConversation,
  appendTurn,
  clearConversation,
  formatHistoryForLLM,
} from "./conversation-manager";
import type {
  AnalystChatIntent,
  ChatRequest,
  ChatResponse,
  ConversationTurn,
  RateLimitResult,
} from "../domain/analyst-chat.types";

// ── Constants ────────────────────────────────────────────────────────────────

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_SECONDS = 3600;
const LOCK_TTL_SECONDS = 25;
const LOCK_MAX_RETRIES = 10;
const LOCK_WAIT_MS = 180;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 600): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      await sleep(delayMs);
    }
  }
  throw new Error("unreachable");
}

// ── Model selection ──────────────────────────────────────────────────────────

function selectModel(intent: AnalystChatIntent): string {
  switch (intent) {
    case "MATCH_PREVIEW":
    case "PREDICTIONS":
    case "GENERAL":
      return "gpt-4o-mini";
    default:
      return "gpt-4.1-nano";
  }
}

/** Intents that benefit from web search when Football-API data is insufficient. */
function shouldUseWebSearch(intent: AnalystChatIntent): boolean {
  return intent === "GENERAL" || intent === "TRANSFERS" || intent === "INJURIES";
}

// ── Rate limiting ────────────────────────────────────────────────────────────

export async function checkRateLimit(clerkId: string): Promise<RateLimitResult> {
  const key = buildChatRateLimitKey(clerkId);
  const count = await redisConnection.incr(key);
  if (count === 1) {
    await redisConnection.expire(key, RATE_LIMIT_WINDOW_SECONDS);
  }
  const ttl = await redisConnection.ttl(key);
  return {
    allowed: count <= RATE_LIMIT_MAX,
    remaining: Math.max(0, RATE_LIMIT_MAX - count),
    resetAt: Date.now() + ttl * 1000,
  };
}

// ── Feedback storage ─────────────────────────────────────────────────────────

const FEEDBACK_TTL = 60 * 60 * 24 * 30; // 30 days
const ENV = process.env.NODE_ENV ?? "dev";

export async function saveFeedback(
  messageId: string,
  rating: "up" | "down",
  sessionId: string
): Promise<void> {
  const key = `minuto90:${ENV}:chat:feedback:${messageId}`;
  await redisConnection.set(
    key,
    JSON.stringify({ rating, sessionId, timestamp: Date.now() }),
    "EX",
    FEEDBACK_TTL
  );
}

// ── Cache-or-compute ─────────────────────────────────────────────────────────

async function getOrComputeCached(
  cacheKey: string,
  ttlSeconds: number,
  compute: () => Promise<string>
): Promise<{ value: string; cacheHit: boolean }> {
  const cached = await redisInsightsCacheStore.get<string>(cacheKey);
  if (cached !== null) {
    return { value: cached, cacheHit: true };
  }

  const lockKey = buildChatLockKey(cacheKey);
  const lockAcquired = await redisInsightsCacheStore.setNx(lockKey, "1", LOCK_TTL_SECONDS);

  if (lockAcquired) {
    try {
      const computed = await compute();
      await redisInsightsCacheStore.set(cacheKey, computed, ttlSeconds);
      return { value: computed, cacheHit: false };
    } finally {
      await redisInsightsCacheStore.del(lockKey);
    }
  }

  for (let retry = 0; retry < LOCK_MAX_RETRIES; retry++) {
    await sleep(LOCK_WAIT_MS);
    const fromCache = await redisInsightsCacheStore.get<string>(cacheKey);
    if (fromCache !== null) {
      return { value: fromCache, cacheHit: true };
    }
  }

  const computed = await compute();
  await redisInsightsCacheStore.set(cacheKey, computed, ttlSeconds);
  return { value: computed, cacheHit: false };
}

// ── LLM input builder (shared between streaming and non-streaming) ───────────

async function buildLLMInput(
  intent: AnalystChatIntent,
  entities: any,
  message: string,
  historyTurns: ConversationTurn[]
): Promise<{ input: string; systemPrompt: string }> {
  const dataContext = await assembleContext(intent, entities);

  const parts: string[] = [];
  parts.push(`fecha_actual: ${new Date().toISOString().slice(0, 10)}`);
  parts.push(`pregunta: ${message}`);

  const history = formatHistoryForLLM(historyTurns);
  if (history) parts.push(history);
  if (dataContext) parts.push(dataContext);

  return {
    input: parts.join("\n\n"),
    systemPrompt: buildSystemPrompt(intent),
  };
}

// ── Non-streaming handler ────────────────────────────────────────────────────

export async function handleChatMessage(request: ChatRequest): Promise<ChatResponse> {
  const startMs = Date.now();
  const conversation = await loadConversation(request.clerkId, request.conversationId);
  const classified = await classifyIntent(request.message, conversation.turns);

  logInfo("analyst_chat.classified", {
    clerkId: request.clerkId,
    intent: classified.intent,
    confidence: classified.confidence,
  });

  const userTurn: ConversationTurn = {
    role: "user",
    content: request.message,
    timestamp: Date.now(),
    intent: classified.intent,
    entities: classified.entities,
  };
  let state = await appendTurn(conversation, userTurn);

  const model = selectModel(classified.intent);
  const cacheKey = buildChatResponseCacheKey(classified.intent, classified.entities);
  const ttl = getChatResponseTtlSeconds(classified.intent);
  const hasHistory = conversation.turns.length > 0;

  let response: string;
  let cacheHit = false;

  if (!hasHistory) {
    const result = await getOrComputeCached(cacheKey, ttl, async () => {
      const { input, systemPrompt } = await buildLLMInput(
        classified.intent, classified.entities, request.message, []
      );
      const completion = await withRetry(() =>
        openai.responses.create({ model, instructions: systemPrompt, input })
      );
      return completion.output_text || "Lo siento, no pude generar una respuesta.";
    });
    response = result.value;
    cacheHit = result.cacheHit;
  } else {
    const { input, systemPrompt } = await buildLLMInput(
      classified.intent, classified.entities, request.message, state.turns.slice(0, -1)
    );
    const completion = await withRetry(() =>
      openai.responses.create({ model, instructions: systemPrompt, input })
    );
    response = completion.output_text || "Lo siento, no pude generar una respuesta.";
  }

  const assistantTurn: ConversationTurn = {
    role: "assistant",
    content: response,
    timestamp: Date.now(),
    intent: classified.intent,
    entities: classified.entities,
  };
  state = await appendTurn(state, assistantTurn);

  return {
    conversationId: state.id,
    response,
    intent: classified.intent,
    meta: { tokensIn: 0, tokensOut: 0, model, latencyMs: Date.now() - startMs, cacheHit },
  };
}

// ── Streaming handler ────────────────────────────────────────────────────────

export type StreamChatPrepared = {
  conversationId: string;
  intent: AnalystChatIntent;
  model: string;
  input: string;
  systemPrompt: string;
  cacheHit: boolean;
  cachedResponse: string | null;
  useWebSearch: boolean;
  /** Must be called after streaming completes to persist assistant turn */
  persistAssistantTurn: (fullText: string) => Promise<void>;
};

/** Prepare everything for streaming (classify, fetch data, build context).
 *  Returns either a cached response or the prepared LLM params for streaming. */
export async function prepareChatStream(request: ChatRequest): Promise<StreamChatPrepared> {
  const conversation = await loadConversation(request.clerkId, request.conversationId);
  const classified = await classifyIntent(request.message, conversation.turns);

  logInfo("analyst_chat.stream.classified", {
    clerkId: request.clerkId,
    intent: classified.intent,
  });

  const userTurn: ConversationTurn = {
    role: "user",
    content: request.message,
    timestamp: Date.now(),
    intent: classified.intent,
    entities: classified.entities,
  };
  const state = await appendTurn(conversation, userTurn);

  const model = selectModel(classified.intent);
  const hasHistory = conversation.turns.length > 0;

  // Check cache for first messages
  if (!hasHistory) {
    const cacheKey = buildChatResponseCacheKey(classified.intent, classified.entities);
    const cached = await redisInsightsCacheStore.get<string>(cacheKey);
    if (cached !== null) {
      return {
        conversationId: state.id,
        intent: classified.intent,
        model,
        input: "",
        systemPrompt: "",
        cacheHit: true,
        cachedResponse: cached,
        useWebSearch: false,
        persistAssistantTurn: async (fullText: string) => {
          await appendTurn(state, {
            role: "assistant",
            content: fullText,
            timestamp: Date.now(),
            intent: classified.intent,
            entities: classified.entities,
          });
        },
      };
    }
  }

  const { input, systemPrompt } = await buildLLMInput(
    classified.intent,
    classified.entities,
    request.message,
    state.turns.slice(0, -1)
  );

  return {
    conversationId: state.id,
    intent: classified.intent,
    model,
    input,
    systemPrompt,
    cacheHit: false,
    cachedResponse: null,
    useWebSearch: shouldUseWebSearch(classified.intent),
    persistAssistantTurn: async (fullText: string) => {
      // Cache the response for future identical queries
      if (!hasHistory) {
        const cacheKey = buildChatResponseCacheKey(classified.intent, classified.entities);
        const ttl = getChatResponseTtlSeconds(classified.intent);
        await redisInsightsCacheStore.set(cacheKey, fullText, ttl);
      }
      await appendTurn(state, {
        role: "assistant",
        content: fullText,
        timestamp: Date.now(),
        intent: classified.intent,
        entities: classified.entities,
      });
    },
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

export { loadConversation, clearConversation };
