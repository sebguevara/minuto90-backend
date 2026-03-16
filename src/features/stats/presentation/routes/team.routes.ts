import { Elysia } from "elysia";
import * as service from "../../application/stats.service";
import {
  minIdParamSchema,
  teamPerformanceQuerySchema,
  teamPositionalQuerySchema,
  teamSituationalQuerySchema,
  teamStreaksQuerySchema,
  teamTopPlayersQuerySchema,
  teamTournamentParamSchema,
  teamTournamentsQuerySchema,
} from "../../dtos/stats.dto";
import { errorResponse } from "../helpers/response.helper";
import { validateQuery } from "../helpers/validation.helper";

const teamTag = "Stats";

export const teamRoutes = new Elysia({ prefix: "/teams" })
  .get(
    "/by-min-id/:minId",
    async ({ params, set }) => {
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
    },
    {
      detail: {
        tags: [teamTag],
        summary: "Obtener equipo por minId",
      },
      params: minIdParamSchema,
    }
  )
  .get(
    "/:minId/tournaments",
    async ({ params, query, set }) => {
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
    },
    {
      detail: {
        tags: [teamTag],
        summary: "Obtener torneos de un equipo",
      },
      params: minIdParamSchema,
      query: teamTournamentsQuerySchema,
    }
  )
  .get(
    "/:minId/performance",
    async ({ params, query, set }) => {
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
    },
    {
      detail: {
        tags: [teamTag],
        summary: "Obtener rendimiento de un equipo",
      },
      params: minIdParamSchema,
      query: teamPerformanceQuerySchema,
    }
  )
  .get(
    "/:minId/positional",
    async ({ params, query, set }) => {
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
    },
    {
      detail: {
        tags: [teamTag],
        summary: "Obtener distribucion posicional de un equipo",
      },
      params: minIdParamSchema,
      query: teamPositionalQuerySchema,
    }
  )
  .get(
    "/:minId/situational",
    async ({ params, query, set }) => {
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
    },
    {
      detail: {
        tags: [teamTag],
        summary: "Obtener datos situacionales de un equipo",
      },
      params: minIdParamSchema,
      query: teamSituationalQuerySchema,
    }
  )
  .get(
    "/:minId/streaks",
    async ({ params, query, set }) => {
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
    },
    {
      detail: {
        tags: [teamTag],
        summary: "Obtener rachas de un equipo",
      },
      params: minIdParamSchema,
      query: teamStreaksQuerySchema,
    }
  )
  .get(
    "/:minId/top-players",
    async ({ params, query, set }) => {
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
    },
    {
      detail: {
        tags: [teamTag],
        summary: "Obtener jugadores destacados de un equipo",
      },
      params: minIdParamSchema,
      query: teamTopPlayersQuerySchema,
    }
  )
  .get(
    "/:minId/tournament/:tournamentId",
    async ({ params, set }) => {
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
    },
    {
      detail: {
        tags: [teamTag],
        summary: "Obtener bundle de un equipo por torneo",
      },
      params: teamTournamentParamSchema,
    }
  );
