import { Elysia } from "elysia";
import * as service from "../../application/stats.service";
import {
  minIdParamSchema,
  teamTournamentsQuerySchema,
  teamPerformanceQuerySchema,
  teamPositionalQuerySchema,
  teamSituationalQuerySchema,
  teamStreaksQuerySchema,
  teamTopPlayersQuerySchema,
  teamTournamentParamSchema,
} from "../../dtos/stats.dto";
import { validateQuery } from "../helpers/validation.helper";
import { errorResponse } from "../helpers/response.helper";

export const teamRoutes = new Elysia({ prefix: "/teams" })
  // 1) GET /teams/by-min-id/:minId
  .get("/by-min-id/:minId", async ({ params, set }) => {
    try {
      const validation = validateQuery(minIdParamSchema, params);
      if (!validation.success) {
        set.status = 400;
        return validation.error;
      }

      const team = await service.getTeamByMinId(validation.data!.minId);
      return { data: team };
    } catch (error: any) {
      if (error.message === "Team not found") {
        set.status = 404;
        return errorResponse(error, "NOT_FOUND");
      }
      set.status = 500;
      return errorResponse(error);
    }
  })

  // 2) GET /teams/:minId/tournaments
  .get("/:minId/tournaments", async ({ params, query, set }) => {
    try {
      const paramValidation = validateQuery(minIdParamSchema, params);
      if (!paramValidation.success) {
        set.status = 400;
        return paramValidation.error;
      }

      const queryValidation = validateQuery(teamTournamentsQuerySchema, query);
      if (!queryValidation.success) {
        set.status = 400;
        return queryValidation.error;
      }

      return await service.getTeamTournaments(
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
  })

  // 3) GET /teams/:minId/performance
  .get("/:minId/performance", async ({ params, query, set }) => {
    try {
      const paramValidation = validateQuery(minIdParamSchema, params);
      if (!paramValidation.success) {
        set.status = 400;
        return paramValidation.error;
      }

      const queryValidation = validateQuery(teamPerformanceQuerySchema, query);
      if (!queryValidation.success) {
        set.status = 400;
        return queryValidation.error;
      }

      return await service.getTeamPerformance(
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
  })

  // 4) GET /teams/:minId/positional
  .get("/:minId/positional", async ({ params, query, set }) => {
    try {
      const paramValidation = validateQuery(minIdParamSchema, params);
      if (!paramValidation.success) {
        set.status = 400;
        return paramValidation.error;
      }

      const queryValidation = validateQuery(teamPositionalQuerySchema, query);
      if (!queryValidation.success) {
        set.status = 400;
        return queryValidation.error;
      }

      return await service.getTeamPositional(
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
  })

  // 5) GET /teams/:minId/situational
  .get("/:minId/situational", async ({ params, query, set }) => {
    try {
      const paramValidation = validateQuery(minIdParamSchema, params);
      if (!paramValidation.success) {
        set.status = 400;
        return paramValidation.error;
      }

      const queryValidation = validateQuery(teamSituationalQuerySchema, query);
      if (!queryValidation.success) {
        set.status = 400;
        return queryValidation.error;
      }

      return await service.getTeamSituational(
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
  })

  // 6) GET /teams/:minId/streaks
  .get("/:minId/streaks", async ({ params, query, set }) => {
    try {
      const paramValidation = validateQuery(minIdParamSchema, params);
      if (!paramValidation.success) {
        set.status = 400;
        return paramValidation.error;
      }

      const queryValidation = validateQuery(teamStreaksQuerySchema, query);
      if (!queryValidation.success) {
        set.status = 400;
        return queryValidation.error;
      }

      return await service.getTeamStreaks(
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
  })

  // 7) GET /teams/:minId/top-players
  .get("/:minId/top-players", async ({ params, query, set }) => {
    try {
      const paramValidation = validateQuery(minIdParamSchema, params);
      if (!paramValidation.success) {
        set.status = 400;
        return paramValidation.error;
      }

      const queryValidation = validateQuery(teamTopPlayersQuerySchema, query);
      if (!queryValidation.success) {
        set.status = 400;
        return queryValidation.error;
      }

      return await service.getTeamTopPlayers(
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
  })

  // 8) GET /teams/:minId/tournament/:tournamentId
  .get("/:minId/tournament/:tournamentId", async ({ params, set }) => {
    try {
      const paramValidation = validateQuery(teamTournamentParamSchema, params);
      if (!paramValidation.success) {
        set.status = 400;
        return paramValidation.error;
      }

      return await service.getTeamTournamentBundle(
        paramValidation.data!.minId,
        paramValidation.data!.tournamentId
      );
    } catch (error: any) {
      if (error.message === "Team not found") {
        set.status = 404;
        return errorResponse(error, "NOT_FOUND");
      }
      set.status = 500;
      return errorResponse(error);
    }
  });
