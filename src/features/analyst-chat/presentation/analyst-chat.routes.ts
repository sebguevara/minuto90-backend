import { Elysia, t } from "elysia";
import { openai } from "../../insights/infrastructure/openai.client";
import {
  handleChatMessage,
  checkRateLimit,
  loadConversation,
  clearConversation,
  prepareChatStream,
  saveFeedback,
} from "../application/analyst-chat.service";

export const analystChatRoutes = new Elysia({ prefix: "/api/chat" })
  // ── POST /api/chat/message (non-streaming, kept as fallback) ───────────────
  .post(
    "/message",
    async ({ body, set }) => {
      try {
        const rateLimit = await checkRateLimit(body.clerkId);
        if (!rateLimit.allowed) {
          set.status = 429;
          return {
            success: false,
            error: "Has alcanzado el limite de mensajes por hora. Intenta de nuevo mas tarde.",
          };
        }

        const response = await handleChatMessage({
          message: body.message,
          clerkId: body.clerkId,
          conversationId: body.conversationId ?? undefined,
        });

        return { success: true, data: response };
      } catch (error: any) {
        set.status = 500;
        return { success: false, error: error?.message || "Error al procesar el mensaje." };
      }
    },
    {
      body: t.Object({
        message: t.String({ minLength: 1, maxLength: 500 }),
        clerkId: t.String({ minLength: 1 }),
        conversationId: t.Optional(t.Union([t.String(), t.Null()])),
      }),
      detail: { tags: ["Chat"], summary: "Enviar mensaje (sin streaming)" },
    }
  )

  // ── POST /api/chat/stream (SSE streaming) ──────────────────────────────────
  .post(
    "/stream",
    async ({ body, set }) => {
      const rateLimit = await checkRateLimit(body.clerkId);
      if (!rateLimit.allowed) {
        set.status = 429;
        return new Response(
          JSON.stringify({
            success: false,
            error: "Has alcanzado el limite de mensajes por hora.",
          }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      }

      const prepared = await prepareChatStream({
        message: body.message,
        clerkId: body.clerkId,
        conversationId: body.conversationId ?? undefined,
      });

      // If cache hit, send the full response immediately as SSE
      if (prepared.cacheHit && prepared.cachedResponse) {
        const fullText = prepared.cachedResponse;
        await prepared.persistAssistantTurn(fullText);

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "meta", conversationId: prepared.conversationId, intent: prepared.intent, model: prepared.model, cacheHit: true })}\n\n`
              )
            );
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "text", content: fullText })}\n\n`)
            );
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
            );
            controller.close();
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }

      // Stream from OpenAI
      const encoder = new TextEncoder();
      let fullText = "";

      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Send metadata first
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "meta", conversationId: prepared.conversationId, intent: prepared.intent, model: prepared.model, cacheHit: false })}\n\n`
              )
            );

            // Stream from OpenAI using responses API with streaming
            const response = await openai.responses.create({
              model: prepared.model,
              reasoning: { effort: prepared.effort },
              instructions: prepared.systemPrompt,
              input: prepared.input,
              stream: true,
            });

            for await (const event of response) {
              if (
                event.type === "response.output_text.delta" &&
                (event as any).delta
              ) {
                const delta = (event as any).delta as string;
                fullText += delta;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "text", content: delta })}\n\n`
                  )
                );
              }
            }

            // Persist the full response
            await prepared.persistAssistantTurn(fullText);

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
            );
          } catch (err: any) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "error", error: err?.message || "Error generando respuesta" })}\n\n`
              )
            );
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    },
    {
      body: t.Object({
        message: t.String({ minLength: 1, maxLength: 500 }),
        clerkId: t.String({ minLength: 1 }),
        conversationId: t.Optional(t.Union([t.String(), t.Null()])),
      }),
      detail: { tags: ["Chat"], summary: "Enviar mensaje con streaming SSE" },
    }
  )

  // ── POST /api/chat/feedback ────────────────────────────────────────────────
  .post(
    "/feedback",
    async ({ body, set }) => {
      try {
        await saveFeedback(body.messageId, body.rating, body.sessionId);
        return { success: true };
      } catch {
        set.status = 500;
        return { success: false, error: "Error al guardar feedback." };
      }
    },
    {
      body: t.Object({
        messageId: t.String({ minLength: 1 }),
        rating: t.Union([t.Literal("up"), t.Literal("down")]),
        sessionId: t.String({ minLength: 1 }),
      }),
      detail: { tags: ["Chat"], summary: "Enviar feedback sobre un mensaje" },
    }
  )

  // ── GET /api/chat/history/:clerkId ─────────────────────────────────────────
  .get(
    "/history/:clerkId",
    async ({ params, set }) => {
      try {
        const conversation = await loadConversation(params.clerkId);
        return {
          success: true,
          data: {
            conversationId: conversation.id,
            messages: conversation.turns.map((t) => ({
              role: t.role,
              content: t.content,
              timestamp: new Date(t.timestamp).toISOString(),
              intent: t.intent,
            })),
          },
        };
      } catch {
        set.status = 500;
        return { success: false, error: "No se pudo cargar el historial." };
      }
    },
    {
      params: t.Object({ clerkId: t.String() }),
      detail: { tags: ["Chat"], summary: "Obtener historial de conversacion" },
    }
  )

  // ── DELETE /api/chat/history/:clerkId ──────────────────────────────────────
  .delete(
    "/history/:clerkId",
    async ({ params, set }) => {
      try {
        await clearConversation(params.clerkId);
        return { success: true };
      } catch {
        set.status = 500;
        return { success: false, error: "No se pudo limpiar el historial." };
      }
    },
    {
      params: t.Object({ clerkId: t.String() }),
      detail: { tags: ["Chat"], summary: "Limpiar historial de conversacion" },
    }
  );
