import { Elysia, t } from "elysia";
import * as service from "../../application/stats.service";
import { minIdParamSchema } from "../../dtos/stats.dto";
import { errorResponse } from "../helpers/response.helper";
import { validateQuery } from "../helpers/validation.helper";

const tag = "Stats";

export const allRoutes = new Elysia({ prefix: "/all" })
  .get(
    "/:minId/complete",
    async ({ params, query, set }) => {
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
          entityType: query?.entityType as "team" | "tournament" | undefined,
        });
      } catch (error: any) {
        if (error.message === "Entity not found with the given minId") {
          set.status = 404;
          return errorResponse(error, "NOT_FOUND");
        }
        set.status = 500;
        return errorResponse(error);
      }
    },
    {
      detail: {
        tags: [tag],
        summary: "Obtener vista completa agregada",
      },
      params: minIdParamSchema,
      query: t.Object({
        playerTables: t.Optional(t.Union([t.Literal("global"), t.Literal("tournament")])),
        entityType: t.Optional(t.Union([t.Literal("team"), t.Literal("tournament")])),
      }),
    }
  )
  .get(
    "/:minId/teams-only",
    async ({ params, query, set }) => {
      try {
        const paramValidation = validateQuery(minIdParamSchema, params);
        if (!paramValidation.success) {
          set.status = 400;
          return paramValidation.error;
        }

        const entityType = query?.entityType as "team" | "tournament" | undefined;
        return await service.getAllTeamsOnlyByMinId(paramValidation.data!.minId, { entityType });
      } catch (error: any) {
        if (error.message === "Entity not found with the given minId") {
          set.status = 404;
          return errorResponse(error, "NOT_FOUND");
        }
        set.status = 500;
        return errorResponse(error);
      }
    },
    {
      detail: {
        tags: [tag],
        summary: "Obtener vista agregada solo de equipos",
      },
      params: minIdParamSchema,
      query: t.Optional(t.Object({
        entityType: t.Optional(t.Union([t.Literal("team"), t.Literal("tournament")])),
      })),
    }
  );
