import { Elysia, t } from "elysia";
import { compareTeams } from "../application/comparator.service";

export const comparatorRoutes = new Elysia({ prefix: "/api/comparator" }).get(
  "/teams",
  async ({ query, set }) => {
    const rawIds = (query.ids as string) ?? "";
    const teamIds = rawIds
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0);

    if (teamIds.length < 2) {
      set.status = 400;
      return { success: false, error: "Se requieren al menos 2 equipos (ids mínimo 2)" };
    }
    if (teamIds.length > 6) {
      set.status = 400;
      return { success: false, error: "Máximo 6 equipos por comparación" };
    }

    try {
      const data = await compareTeams(teamIds);
      return { success: true, data };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error?.message ?? "Error al obtener perfiles de equipos" };
    }
  },
  {
    query: t.Object({
      ids: t.String({ description: "Comma-separated API-Football team IDs (2–6)" }),
    }),
    detail: {
      tags: ["Stats"],
      summary: "Comparar equipos",
      description:
        "Devuelve perfiles normalizados de 2 a 6 equipos para comparación side-by-side. Combina datos de API-Football y WhoScored.",
    },
  }
);
