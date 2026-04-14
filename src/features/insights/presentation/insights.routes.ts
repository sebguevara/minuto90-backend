import { Elysia, t } from "elysia";
import { insightsService } from "../application/insights.service";
import { generateMomentumNarrative } from "../application/momentum.service";
import type { MomentumSignal } from "../application/momentum.types";

export const insightsRoutes = new Elysia({ prefix: "/api/insights" })
  .get(
    "/match/:fixtureId/streaks",
    async ({ params, set }) => {
      try {
        const payload = await insightsService.getMatchStreaks(params.fixtureId);
        return { success: true, data: payload };
      } catch (error: any) {
        if (error?.message === "Partido no encontrado") {
          set.status = 404;
          return { success: false, error: "Partido no encontrado" };
        }
        set.status = 500;
        return { success: false, error: "No se pudieron generar las rachas del partido" };
      }
    },
    {
      params: t.Object({
        fixtureId: t.Numeric({ description: "Fixture ID for the match" }),
      }),
      detail: {
        tags: ["Insights"],
        summary: "Obtener rachas e insights de los ultimos partidos",
        description:
          "Devuelve métricas recientes por equipo (últimos 10), rachas actuales y datos interesantes del partido.",
      },
    }
  )
  .get(
    "/match/:fixtureId/summary",
    async ({ params, set }) => {
      try {
        const summary = await insightsService.generateMatchSummary(params.fixtureId);
        return { success: true, data: summary };
      } catch (error: any) {
        set.status = 500;
        return { success: false, error: error.message };
      }
    },
    {
      params: t.Object({
        fixtureId: t.Numeric({ description: "Fixture ID for the match" }),
      }),
      detail: {
        tags: ["Insights"],
        summary: "Obtener resumen del partido generado por IA",
        description: "Devuelve un resumen narrado por un experto basado en los datos estadísticos y eventos del partido.",
      },
    }
  )
  .get(
    "/daily",
    async ({ query, set }) => {
      try {
        const insights = await insightsService.generateDailyInsights(query.date);
        return { success: true, data: insights };
      } catch (error: any) {
        set.status = 500;
        return { success: false, error: error.message };
      }
    },
    {
      query: t.Object({
        date: t.String({ description: "Date in YYYY-MM-DD format", examples: ["2023-10-25"] }),
      }),
      detail: {
        tags: ["Insights"],
        summary: "Obtener insights destacados del día",
        description: "Devuelve los partidos más recomendados del día con un breve análisis editorial.",
      },
    }
  )
  .get(
    "/featured",
    async ({ query, set }) => {
      try {
        const limit = Math.min(30, Math.max(1, Number(query.limit) || 10));
        const featured = await insightsService.getFeaturedMatches(
          query.date,
          limit,
          query.userCountry ?? null
        );
        return { success: true, data: featured };
      } catch (error: any) {
        set.status = 500;
        return { success: false, error: error.message };
      }
    },
    {
      query: t.Object({
        date: t.String({ description: "Date in YYYY-MM-DD format", examples: ["2025-03-26"] }),
        limit: t.Optional(t.String({ description: "Max results (default 10, max 30)" })),
        userCountry: t.Optional(t.String({ description: "User country for localized ranking" })),
      }),
      detail: {
        tags: ["Insights"],
        summary: "Obtener partidos destacados del día",
        description:
          "Devuelve los partidos más relevantes de una fecha, ordenados por score de relevancia automático (liga, posición en tabla, ronda, rivalidad).",
      },
    }
  )
  .post(
    "/match/:fixtureId/momentum",
    async ({ params, body, set }) => {
      try {
        const signal: MomentumSignal = {
          ...body,
          fixtureId: params.fixtureId,
        };
        const narrative = await generateMomentumNarrative(signal);
        return { success: true, data: narrative };
      } catch (error: any) {
        set.status = 500;
        return { success: false, error: error.message ?? "Error al generar insight de momentum" };
      }
    },
    {
      params: t.Object({
        fixtureId: t.Numeric({ description: "Fixture ID for the match" }),
      }),
      body: t.Object({
        minute: t.Number(),
        homeTeam: t.String(),
        awayTeam: t.String(),
        signalType: t.String(),
        team: t.Union([t.Literal("home"), t.Literal("away")]),
        stats: t.Record(t.String(), t.Union([t.Number(), t.String()])),
        delta: t.Record(t.String(), t.Number()),
        probability: t.Optional(t.Number()),
      }),
      detail: {
        tags: ["Insights"],
        summary: "Generar insight de momentum en vivo",
        description:
          "Recibe una señal de momentum detectada en el frontend y genera un texto narrativo con OpenAI.",
      },
    }
  );
