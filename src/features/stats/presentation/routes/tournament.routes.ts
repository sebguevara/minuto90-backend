import { Elysia } from "elysia";
import * as service from "../../application/stats.service";
import {
  minIdParamSchema,
  tournamentTeamsQuerySchema,
  tournamentTablesQuerySchema,
  tournamentPlayerTablesQuerySchema,
  tournamentBestXIQuerySchema,
} from "../../dtos/stats.dto";
import { validateQuery } from "../helpers/validation.helper";
import { errorResponse } from "../helpers/response.helper";

export const tournamentRoutes = new Elysia({ prefix: "/tournaments" })
  // 9) GET /tournaments/by-min-id/:minId
  .get("/by-min-id/:minId", async ({ params, set }) => {
    try {
      const validation = validateQuery(minIdParamSchema, params);
      if (!validation.success) {
        set.status = 400;
        return validation.error;
      }

      const tournament = await service.getTournamentByMinId(
        validation.data!.minId
      );
      return { data: tournament };
    } catch (error: any) {
      if (error.message === "Tournament not found") {
        set.status = 404;
        return errorResponse(error, "NOT_FOUND");
      }
      set.status = 500;
      return errorResponse(error);
    }
  })

  // 10) GET /tournaments/:minId/teams
  .get("/:minId/teams", async ({ params, query, set }) => {
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
  })

  // 11) GET /tournaments/:minId/tables
  .get("/:minId/tables", async ({ params, query, set }) => {
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
  })

  // 12) GET /tournaments/:minId/player-tables
  .get("/:minId/player-tables", async ({ params, query, set }) => {
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
  })

  // 13) GET /tournaments/:minId/best-xi
  .get("/:minId/best-xi", async ({ params, query, set }) => {
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
  });
