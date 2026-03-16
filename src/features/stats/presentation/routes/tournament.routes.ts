import { Elysia } from "elysia";
import * as service from "../../application/stats.service";
import {
  minIdParamSchema,
  tournamentBestXIQuerySchema,
  tournamentPlayerTablesQuerySchema,
  tournamentTablesQuerySchema,
  tournamentTeamsQuerySchema,
} from "../../dtos/stats.dto";
import { errorResponse } from "../helpers/response.helper";
import { validateQuery } from "../helpers/validation.helper";

const tag = "Stats";

export const tournamentRoutes = new Elysia({ prefix: "/tournaments" })
  .get(
    "/by-min-id/:minId",
    async ({ params, set }) => {
      try {
        const validation = validateQuery(minIdParamSchema, params);
        if (!validation.success) {
          set.status = 400;
          return validation.error;
        }

        const tournament = await service.getTournamentByMinId(validation.data!.minId);
        return { data: tournament };
      } catch (error: any) {
        if (error.message === "Tournament not found") {
          set.status = 404;
          return errorResponse(error, "NOT_FOUND");
        }
        set.status = 500;
        return errorResponse(error);
      }
    },
    {
      detail: { tags: [tag], summary: "Obtener torneo por minId" },
      params: minIdParamSchema,
    }
  )
  .get(
    "/:minId/teams",
    async ({ params, query, set }) => {
      try {
        const paramValidation = validateQuery(minIdParamSchema, params);
        if (!paramValidation.success) {
          set.status = 400;
          return paramValidation.error;
        }

        const queryValidation = validateQuery(tournamentTeamsQuerySchema, query);
        if (!queryValidation.success) {
          set.status = 400;
          return queryValidation.error;
        }

        return await service.getTournamentTeams(
          paramValidation.data!.minId,
          queryValidation.data!
        );
      } catch (error: any) {
        if (error.message === "Tournament not found") {
          set.status = 404;
          return errorResponse(error, "NOT_FOUND");
        }
        set.status = 500;
        return errorResponse(error);
      }
    },
    {
      detail: { tags: [tag], summary: "Obtener equipos de un torneo" },
      params: minIdParamSchema,
      query: tournamentTeamsQuerySchema,
    }
  )
  .get(
    "/:minId/tables",
    async ({ params, query, set }) => {
      try {
        const paramValidation = validateQuery(minIdParamSchema, params);
        if (!paramValidation.success) {
          set.status = 400;
          return paramValidation.error;
        }

        const queryValidation = validateQuery(tournamentTablesQuerySchema, query);
        if (!queryValidation.success) {
          set.status = 400;
          return queryValidation.error;
        }

        return await service.getTournamentTables(
          paramValidation.data!.minId,
          queryValidation.data!
        );
      } catch (error: any) {
        if (error.message === "Tournament not found") {
          set.status = 404;
          return errorResponse(error, "NOT_FOUND");
        }
        set.status = 500;
        return errorResponse(error);
      }
    },
    {
      detail: { tags: [tag], summary: "Obtener tablas de un torneo" },
      params: minIdParamSchema,
      query: tournamentTablesQuerySchema,
    }
  )
  .get(
    "/:minId/player-tables",
    async ({ params, query, set }) => {
      try {
        const paramValidation = validateQuery(minIdParamSchema, params);
        if (!paramValidation.success) {
          set.status = 400;
          return paramValidation.error;
        }

        const queryValidation = validateQuery(
          tournamentPlayerTablesQuerySchema,
          query
        );
        if (!queryValidation.success) {
          set.status = 400;
          return queryValidation.error;
        }

        return await service.getTournamentPlayerTables(
          paramValidation.data!.minId,
          queryValidation.data!
        );
      } catch (error: any) {
        if (error.message === "Tournament not found") {
          set.status = 404;
          return errorResponse(error, "NOT_FOUND");
        }
        set.status = 500;
        return errorResponse(error);
      }
    },
    {
      detail: { tags: [tag], summary: "Obtener tablas de jugadores de un torneo" },
      params: minIdParamSchema,
      query: tournamentPlayerTablesQuerySchema,
    }
  )
  .get(
    "/:minId/best-xi",
    async ({ params, query, set }) => {
      try {
        const paramValidation = validateQuery(minIdParamSchema, params);
        if (!paramValidation.success) {
          set.status = 400;
          return paramValidation.error;
        }

        const queryValidation = validateQuery(tournamentBestXIQuerySchema, query);
        if (!queryValidation.success) {
          set.status = 400;
          return queryValidation.error;
        }

        return await service.getTournamentBestXI(
          paramValidation.data!.minId,
          queryValidation.data!
        );
      } catch (error: any) {
        if (
          error.message === "Tournament not found" ||
          error.message === "Best XI not found for the specified criteria"
        ) {
          set.status = 404;
          return errorResponse(error, "NOT_FOUND");
        }
        set.status = 500;
        return errorResponse(error);
      }
    },
    {
      detail: { tags: [tag], summary: "Obtener XI ideal de un torneo" },
      params: minIdParamSchema,
      query: tournamentBestXIQuerySchema,
    }
  );
