import { Elysia } from "elysia";
import * as service from "../../application/stats.service";
import { minIdParamSchema } from "../../dtos/stats.dto";
import { validateQuery } from "../helpers/validation.helper";
import { errorResponse } from "../helpers/response.helper";

export const matchProfileRoutes = new Elysia({ prefix: "/match-profile" }).get(
  "/:minId",
  async ({ params, set }) => {
    try {
      const paramValidation = validateQuery(minIdParamSchema, params);
      if (!paramValidation.success) {
        set.status = 400;
        return paramValidation.error;
      }

      return await service.getTeamMatchProfile(paramValidation.data!.minId);
    } catch (error: any) {
      if (error.message === "Team not found") {
        set.status = 404;
        return errorResponse(error, "NOT_FOUND");
      }
      set.status = 500;
      return errorResponse(error);
    }
  },
  {
    detail: {
      tags: ["Match Profile"],
      summary: "Perfil completo del equipo para vista de partido",
      description:
        "Retorna características (fortalezas/debilidades), estilo de juego, widgets situacionales y estadísticas top (summary, ofensiva, defensiva, xG) del equipo. Incluye también topStatsGrouped para navegar por torneo y viewType sin filtrar.",
    },
  }
);
