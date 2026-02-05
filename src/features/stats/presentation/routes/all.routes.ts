import { Elysia } from "elysia";
import * as service from "../../application/stats.service";
import { minIdParamSchema } from "../../dtos/stats.dto";
import { validateQuery } from "../helpers/validation.helper";
import { errorResponse } from "../helpers/response.helper";

export const allRoutes = new Elysia({ prefix: "/all" })
  // GET /all/:minId/complete - Información COMPLETA (equipos + jugadores)
  .get("/:minId/complete", async ({ params, query, set }) => {
    try {
      const paramValidation = validateQuery(minIdParamSchema, params);
      if (!paramValidation.success) {
        set.status = 400;
        return paramValidation.error;
      }

      const playerTables =
        (query?.playerTables as string | undefined) === "global"
          ? "global"
          : "tournament";

      return await service.getAllCompleteByMinId(paramValidation.data!.minId, {
        playerTables,
      });
    } catch (error: any) {
      if (error.message === "Entity not found with the given minId") {
        set.status = 404;
        return errorResponse(error, "NOT_FOUND");
      }
      set.status = 500;
      return errorResponse(error);
    }
  })

  // GET /all/:minId/teams-only - Solo información de EQUIPOS (sin jugadores)
  .get("/:minId/teams-only", async ({ params, set }) => {
    try {
      const paramValidation = validateQuery(minIdParamSchema, params);
      if (!paramValidation.success) {
        set.status = 400;
        return paramValidation.error;
      }

      return await service.getAllTeamsOnlyByMinId(paramValidation.data!.minId);
    } catch (error: any) {
      if (error.message === "Entity not found with the given minId") {
        set.status = 404;
        return errorResponse(error, "NOT_FOUND");
      }
      set.status = 500;
      return errorResponse(error);
    }
  });
