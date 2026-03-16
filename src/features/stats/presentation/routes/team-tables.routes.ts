import { Elysia } from "elysia";
import * as service from "../../application/team-tables.service";
import {
  minIdParamSchema,
  teamPlayerTableQuerySchema,
  teamTableQuerySchema,
} from "../../dtos/stats.dto";
import { errorResponse } from "../helpers/response.helper";
import { validateQuery } from "../helpers/validation.helper";

const tag = "Stats";

export const teamTablesRoutes = new Elysia({ prefix: "/teams" })
  .get(
    "/:minId/tables/defensive",
    async ({ params, query, set }) => {
      try {
        const paramValidation = validateQuery(minIdParamSchema, params);
        if (!paramValidation.success) {
          set.status = 400;
          return paramValidation.error;
        }

        const queryValidation = validateQuery(teamTableQuerySchema, query);
        if (!queryValidation.success) {
          set.status = 400;
          return queryValidation.error;
        }

        return await service.getTeamDefensiveTableByMinId(
          paramValidation.data!.minId,
          queryValidation.data!
        );
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
      detail: { tags: [tag], summary: "Obtener tabla defensiva de un equipo" },
      params: minIdParamSchema,
      query: teamTableQuerySchema,
    }
  )
  .get(
    "/:minId/tables/offensive",
    async ({ params, query, set }) => {
      try {
        const paramValidation = validateQuery(minIdParamSchema, params);
        if (!paramValidation.success) {
          set.status = 400;
          return paramValidation.error;
        }

        const queryValidation = validateQuery(teamTableQuerySchema, query);
        if (!queryValidation.success) {
          set.status = 400;
          return queryValidation.error;
        }

        return await service.getTeamOffensiveTableByMinId(
          paramValidation.data!.minId,
          queryValidation.data!
        );
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
      detail: { tags: [tag], summary: "Obtener tabla ofensiva de un equipo" },
      params: minIdParamSchema,
      query: teamTableQuerySchema,
    }
  )
  .get(
    "/:minId/tables/summary",
    async ({ params, query, set }) => {
      try {
        const paramValidation = validateQuery(minIdParamSchema, params);
        if (!paramValidation.success) {
          set.status = 400;
          return paramValidation.error;
        }

        const queryValidation = validateQuery(teamTableQuerySchema, query);
        if (!queryValidation.success) {
          set.status = 400;
          return queryValidation.error;
        }

        return await service.getTeamSummaryTableByMinId(
          paramValidation.data!.minId,
          queryValidation.data!
        );
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
      detail: { tags: [tag], summary: "Obtener tabla resumida de un equipo" },
      params: minIdParamSchema,
      query: teamTableQuerySchema,
    }
  )
  .get(
    "/:minId/tables/xg",
    async ({ params, query, set }) => {
      try {
        const paramValidation = validateQuery(minIdParamSchema, params);
        if (!paramValidation.success) {
          set.status = 400;
          return paramValidation.error;
        }

        const queryValidation = validateQuery(teamTableQuerySchema, query);
        if (!queryValidation.success) {
          set.status = 400;
          return queryValidation.error;
        }

        return await service.getTeamXGTableByMinId(
          paramValidation.data!.minId,
          queryValidation.data!
        );
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
      detail: { tags: [tag], summary: "Obtener tabla xG de un equipo" },
      params: minIdParamSchema,
      query: teamTableQuerySchema,
    }
  )
  .get(
    "/:minId/player-tables/defensive",
    async ({ params, query, set }) => {
      try {
        const paramValidation = validateQuery(minIdParamSchema, params);
        if (!paramValidation.success) {
          set.status = 400;
          return paramValidation.error;
        }

        const queryValidation = validateQuery(teamPlayerTableQuerySchema, query);
        if (!queryValidation.success) {
          set.status = 400;
          return queryValidation.error;
        }

        return await service.getTeamPlayerDefensiveTableByMinId(
          paramValidation.data!.minId,
          queryValidation.data!
        );
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
      detail: { tags: [tag], summary: "Obtener tabla defensiva de jugadores por equipo" },
      params: minIdParamSchema,
      query: teamPlayerTableQuerySchema,
    }
  )
  .get(
    "/:minId/player-tables/offensive",
    async ({ params, query, set }) => {
      try {
        const paramValidation = validateQuery(minIdParamSchema, params);
        if (!paramValidation.success) {
          set.status = 400;
          return paramValidation.error;
        }

        const queryValidation = validateQuery(teamPlayerTableQuerySchema, query);
        if (!queryValidation.success) {
          set.status = 400;
          return queryValidation.error;
        }

        return await service.getTeamPlayerOffensiveTableByMinId(
          paramValidation.data!.minId,
          queryValidation.data!
        );
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
      detail: { tags: [tag], summary: "Obtener tabla ofensiva de jugadores por equipo" },
      params: minIdParamSchema,
      query: teamPlayerTableQuerySchema,
    }
  )
  .get(
    "/:minId/player-tables/passing",
    async ({ params, query, set }) => {
      try {
        const paramValidation = validateQuery(minIdParamSchema, params);
        if (!paramValidation.success) {
          set.status = 400;
          return paramValidation.error;
        }

        const queryValidation = validateQuery(teamPlayerTableQuerySchema, query);
        if (!queryValidation.success) {
          set.status = 400;
          return queryValidation.error;
        }

        return await service.getTeamPlayerPassingTableByMinId(
          paramValidation.data!.minId,
          queryValidation.data!
        );
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
      detail: { tags: [tag], summary: "Obtener tabla de pases de jugadores por equipo" },
      params: minIdParamSchema,
      query: teamPlayerTableQuerySchema,
    }
  )
  .get(
    "/:minId/player-tables/summary",
    async ({ params, query, set }) => {
      try {
        const paramValidation = validateQuery(minIdParamSchema, params);
        if (!paramValidation.success) {
          set.status = 400;
          return paramValidation.error;
        }

        const queryValidation = validateQuery(teamPlayerTableQuerySchema, query);
        if (!queryValidation.success) {
          set.status = 400;
          return queryValidation.error;
        }

        return await service.getTeamPlayerSummaryTableByMinId(
          paramValidation.data!.minId,
          queryValidation.data!
        );
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
      detail: { tags: [tag], summary: "Obtener tabla resumida de jugadores por equipo" },
      params: minIdParamSchema,
      query: teamPlayerTableQuerySchema,
    }
  )
  .get(
    "/:minId/player-tables/xg",
    async ({ params, query, set }) => {
      try {
        const paramValidation = validateQuery(minIdParamSchema, params);
        if (!paramValidation.success) {
          set.status = 400;
          return paramValidation.error;
        }

        const queryValidation = validateQuery(teamPlayerTableQuerySchema, query);
        if (!queryValidation.success) {
          set.status = 400;
          return queryValidation.error;
        }

        return await service.getTeamPlayerXGTableByMinId(
          paramValidation.data!.minId,
          queryValidation.data!
        );
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
      detail: { tags: [tag], summary: "Obtener tabla xG de jugadores por equipo" },
      params: minIdParamSchema,
      query: teamPlayerTableQuerySchema,
    }
  );
