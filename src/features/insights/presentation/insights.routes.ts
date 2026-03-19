import { Elysia, t } from "elysia";
import { insightsService } from "../application/insights.service";

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
  );
