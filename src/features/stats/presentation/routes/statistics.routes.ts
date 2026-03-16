import { Elysia } from "elysia";
import * as service from "../../application/statistics.service";
import { errorResponse } from "../helpers/response.helper";

const leaderboardsTag = "Stats";
const insightsTag = "Stats";

export const statisticsRoutes = new Elysia({ prefix: "/statistics" })
  .get(
    "/teams/:tournamentId/summary",
    async ({ params, query, set }) => {
      try {
        const tournamentId = parseInt(params.tournamentId);
        const viewTypeId = parseInt(query.viewTypeId as string);
        const categoryId = query.categoryId ? parseInt(query.categoryId as string) : undefined;
        const sectionId = query.sectionId ? parseInt(query.sectionId as string) : undefined;
        const limit = query.limit ? parseInt(query.limit as string) : 20;
        const offset = query.offset ? parseInt(query.offset as string) : 0;

        return await service.getTeamSummaryStats(
          tournamentId,
          viewTypeId,
          categoryId,
          sectionId,
          { limit, offset }
        );
      } catch (error: any) {
        set.status = error.message.includes("not found") ? 404 : 500;
        return errorResponse(error);
      }
    },
    {
      detail: {
        tags: [leaderboardsTag],
        summary: "Obtener estadisticas resumidas de equipos",
        description:
          "Retorna resumenes de equipos con goles, tiros, tarjetas, posesion, pases y mas.",
      },
    }
  )
  .get(
    "/teams/:tournamentId/defensive",
    async ({ params, query, set }) => {
      try {
        const tournamentId = parseInt(params.tournamentId);
        const viewTypeId = parseInt(query.viewTypeId as string);
        const categoryId = query.categoryId ? parseInt(query.categoryId as string) : undefined;
        const sectionId = query.sectionId ? parseInt(query.sectionId as string) : undefined;
        const limit = query.limit ? parseInt(query.limit as string) : 20;
        const offset = query.offset ? parseInt(query.offset as string) : 0;

        return await service.getTeamDefensiveStats(
          tournamentId,
          viewTypeId,
          categoryId,
          sectionId,
          { limit, offset }
        );
      } catch (error: any) {
        set.status = error.message.includes("not found") ? 404 : 500;
        return errorResponse(error);
      }
    },
    {
      detail: {
        tags: [leaderboardsTag],
        summary: "Obtener estadisticas defensivas de equipos",
        description:
          "Retorna tackles, intercepciones, faltas, despejes, tiros recibidos y mas.",
      },
    }
  )
  .get(
    "/teams/:tournamentId/offensive",
    async ({ params, query, set }) => {
      try {
        const tournamentId = parseInt(params.tournamentId);
        const viewTypeId = parseInt(query.viewTypeId as string);
        const categoryId = query.categoryId ? parseInt(query.categoryId as string) : undefined;
        const sectionId = query.sectionId ? parseInt(query.sectionId as string) : undefined;
        const limit = query.limit ? parseInt(query.limit as string) : 20;
        const offset = query.offset ? parseInt(query.offset as string) : 0;

        return await service.getTeamOffensiveStats(
          tournamentId,
          viewTypeId,
          categoryId,
          sectionId,
          { limit, offset }
        );
      } catch (error: any) {
        set.status = error.message.includes("not found") ? 404 : 500;
        return errorResponse(error);
      }
    },
    {
      detail: {
        tags: [leaderboardsTag],
        summary: "Obtener estadisticas ofensivas de equipos",
        description:
          "Retorna tiros, tiros a porteria, regates, faltas recibidas y mas.",
      },
    }
  )
  .get(
    "/teams/:tournamentId/xg",
    async ({ params, query, set }) => {
      try {
        const tournamentId = parseInt(params.tournamentId);
        const viewTypeId = parseInt(query.viewTypeId as string);
        const categoryId = query.categoryId ? parseInt(query.categoryId as string) : undefined;
        const sectionId = query.sectionId ? parseInt(query.sectionId as string) : undefined;
        const limit = query.limit ? parseInt(query.limit as string) : 20;
        const offset = query.offset ? parseInt(query.offset as string) : 0;

        return await service.getTeamXGStats(
          tournamentId,
          viewTypeId,
          categoryId,
          sectionId,
          { limit, offset }
        );
      } catch (error: any) {
        set.status = error.message.includes("not found") ? 404 : 500;
        return errorResponse(error);
      }
    },
    {
      detail: {
        tags: [leaderboardsTag],
        summary: "Obtener estadisticas xG de equipos",
        description: "Retorna xG, goles, diferencia xG, tiros y xG por tiro.",
      },
    }
  )
  .get(
    "/players/:tournamentId/summary",
    async ({ params, query, set }) => {
      try {
        const tournamentId = parseInt(params.tournamentId);
        const viewTypeId = parseInt(query.viewTypeId as string);
        const categoryId = query.categoryId ? parseInt(query.categoryId as string) : undefined;
        const sectionId = query.sectionId ? parseInt(query.sectionId as string) : undefined;
        const limit = query.limit ? parseInt(query.limit as string) : 20;
        const offset = query.offset ? parseInt(query.offset as string) : 0;

        return await service.getPlayerSummaryStats(
          tournamentId,
          viewTypeId,
          categoryId,
          sectionId,
          { limit, offset }
        );
      } catch (error: any) {
        set.status = error.message.includes("not found") ? 404 : 500;
        return errorResponse(error);
      }
    },
    {
      detail: {
        tags: [leaderboardsTag],
        summary: "Obtener estadisticas resumidas de jugadores",
        description:
          "Retorna goles, asistencias, tarjetas, tiros, pases, duelos aereos y rating.",
      },
    }
  )
  .get(
    "/players/:tournamentId/defensive",
    async ({ params, query, set }) => {
      try {
        const tournamentId = parseInt(params.tournamentId);
        const viewTypeId = parseInt(query.viewTypeId as string);
        const categoryId = query.categoryId ? parseInt(query.categoryId as string) : undefined;
        const sectionId = query.sectionId ? parseInt(query.sectionId as string) : undefined;
        const limit = query.limit ? parseInt(query.limit as string) : 20;
        const offset = query.offset ? parseInt(query.offset as string) : 0;

        return await service.getPlayerDefensiveStats(
          tournamentId,
          viewTypeId,
          categoryId,
          sectionId,
          { limit, offset }
        );
      } catch (error: any) {
        set.status = error.message.includes("not found") ? 404 : 500;
        return errorResponse(error);
      }
    },
    {
      detail: {
        tags: [leaderboardsTag],
        summary: "Obtener estadisticas defensivas de jugadores",
        description:
          "Retorna tackles, intercepciones, faltas, despejes y metricas defensivas.",
      },
    }
  )
  .get(
    "/players/:tournamentId/offensive",
    async ({ params, query, set }) => {
      try {
        const tournamentId = parseInt(params.tournamentId);
        const viewTypeId = parseInt(query.viewTypeId as string);
        const categoryId = query.categoryId ? parseInt(query.categoryId as string) : undefined;
        const sectionId = query.sectionId ? parseInt(query.sectionId as string) : undefined;
        const limit = query.limit ? parseInt(query.limit as string) : 20;
        const offset = query.offset ? parseInt(query.offset as string) : 0;

        return await service.getPlayerOffensiveStats(
          tournamentId,
          viewTypeId,
          categoryId,
          sectionId,
          { limit, offset }
        );
      } catch (error: any) {
        set.status = error.message.includes("not found") ? 404 : 500;
        return errorResponse(error);
      }
    },
    {
      detail: {
        tags: [leaderboardsTag],
        summary: "Obtener estadisticas ofensivas de jugadores",
        description:
          "Retorna tiros, tiros a porteria, pases clave, regates y metricas ofensivas.",
      },
    }
  )
  .get(
    "/players/:tournamentId/passing",
    async ({ params, query, set }) => {
      try {
        const tournamentId = parseInt(params.tournamentId);
        const viewTypeId = parseInt(query.viewTypeId as string);
        const categoryId = query.categoryId ? parseInt(query.categoryId as string) : undefined;
        const sectionId = query.sectionId ? parseInt(query.sectionId as string) : undefined;
        const limit = query.limit ? parseInt(query.limit as string) : 20;
        const offset = query.offset ? parseInt(query.offset as string) : 0;

        return await service.getPlayerPassingStats(
          tournamentId,
          viewTypeId,
          categoryId,
          sectionId,
          { limit, offset }
        );
      } catch (error: any) {
        set.status = error.message.includes("not found") ? 404 : 500;
        return errorResponse(error);
      }
    },
    {
      detail: {
        tags: [leaderboardsTag],
        summary: "Obtener estadisticas de pases de jugadores",
        description:
          "Retorna pases clave, pases totales, precision, centros y pases largos.",
      },
    }
  )
  .get(
    "/players/:tournamentId/xg",
    async ({ params, query, set }) => {
      try {
        const tournamentId = parseInt(params.tournamentId);
        const viewTypeId = parseInt(query.viewTypeId as string);
        const categoryId = query.categoryId ? parseInt(query.categoryId as string) : undefined;
        const sectionId = query.sectionId ? parseInt(query.sectionId as string) : undefined;
        const limit = query.limit ? parseInt(query.limit as string) : 20;
        const offset = query.offset ? parseInt(query.offset as string) : 0;

        return await service.getPlayerXGStats(
          tournamentId,
          viewTypeId,
          categoryId,
          sectionId,
          { limit, offset }
        );
      } catch (error: any) {
        set.status = error.message.includes("not found") ? 404 : 500;
        return errorResponse(error);
      }
    },
    {
      detail: {
        tags: [leaderboardsTag],
        summary: "Obtener estadisticas xG de jugadores",
        description: "Retorna xG, npxG, xG assist, xG chain y xG buildup.",
      },
    }
  )
  .get(
    "/teams/:tournamentId/streaks",
    async ({ params, query, set }) => {
      try {
        const tournamentId = parseInt(params.tournamentId);
        const viewTypeId = parseInt(query.viewTypeId as string);
        const mode = (query.mode as string) || "all";
        const scope = (query.scope as string) || "Current";
        const limit = query.limit ? parseInt(query.limit as string) : 20;
        const offset = query.offset ? parseInt(query.offset as string) : 0;

        return await service.getTeamStreaks(
          tournamentId,
          viewTypeId,
          mode,
          scope,
          { limit, offset }
        );
      } catch (error: any) {
        set.status = error.message.includes("not found") ? 404 : 500;
        return errorResponse(error);
      }
    },
    {
      detail: {
        tags: [insightsTag],
        summary: "Obtener rachas de equipos",
        description:
          "Retorna rachas vigentes o historicas de victorias, derrotas, empates y otras variantes.",
      },
    }
  )
  .get(
    "/teams/:tournamentId/performance",
    async ({ params, query, set }) => {
      try {
        const tournamentId = parseInt(params.tournamentId);
        const viewTypeId = parseInt(query.viewTypeId as string);
        const mode = (query.mode as string) || "all";
        const limit = query.limit ? parseInt(query.limit as string) : 20;
        const offset = query.offset ? parseInt(query.offset as string) : 0;

        return await service.getTeamPerformance(
          tournamentId,
          viewTypeId,
          mode,
          { limit, offset }
        );
      } catch (error: any) {
        set.status = error.message.includes("not found") ? 404 : 500;
        return errorResponse(error);
      }
    },
    {
      detail: {
        tags: [insightsTag],
        summary: "Obtener rendimiento de equipos",
        description:
          "Retorna partidos jugados, porcentajes de victorias, empates, derrotas y promedios de goles.",
      },
    }
  )
  .get(
    "/tournaments/:tournamentId/best-xi",
    async ({ params, query, set }) => {
      try {
        const tournamentId = parseInt(params.tournamentId);
        const timeframe = (query.timeframe as string) || "season";
        const startDate = query.startDate ? new Date(query.startDate as string) : undefined;
        const endDate = query.endDate ? new Date(query.endDate as string) : undefined;

        return await service.getBestXI(tournamentId, timeframe, startDate, endDate);
      } catch (error: any) {
        set.status = error.message.includes("not found") ? 404 : 500;
        return errorResponse(error);
      }
    },
    {
      detail: {
        tags: [leaderboardsTag],
        summary: "Obtener XI ideal del torneo",
        description:
          "Retorna el once ideal del torneo segun el rango temporal seleccionado.",
      },
    }
  )
  .get(
    "/tournaments/:tournamentId/top-players/rating",
    async ({ params, query, set }) => {
      try {
        const tournamentId = parseInt(params.tournamentId);
        const viewTypeId = parseInt(query.viewTypeId as string);
        const limit = query.limit ? parseInt(query.limit as string) : 10;

        return await service.getTopPlayersByRating(tournamentId, viewTypeId, limit);
      } catch (error: any) {
        set.status = error.message.includes("not found") ? 404 : 500;
        return errorResponse(error);
      }
    },
    {
      detail: {
        tags: [leaderboardsTag],
        summary: "Obtener jugadores con mejor rating",
      },
    }
  )
  .get(
    "/tournaments/:tournamentId/top-players/assists",
    async ({ params, query, set }) => {
      try {
        const tournamentId = parseInt(params.tournamentId);
        const viewTypeId = parseInt(query.viewTypeId as string);
        const limit = query.limit ? parseInt(query.limit as string) : 10;

        return await service.getTopPlayersByAssists(tournamentId, viewTypeId, limit);
      } catch (error: any) {
        set.status = error.message.includes("not found") ? 404 : 500;
        return errorResponse(error);
      }
    },
    {
      detail: {
        tags: [leaderboardsTag],
        summary: "Obtener jugadores con mas asistencias",
      },
    }
  )
  .get(
    "/tournaments/:tournamentId/top-players/shots",
    async ({ params, query, set }) => {
      try {
        const tournamentId = parseInt(params.tournamentId);
        const viewTypeId = parseInt(query.viewTypeId as string);
        const limit = query.limit ? parseInt(query.limit as string) : 10;

        return await service.getTopPlayersByShots(tournamentId, viewTypeId, limit);
      } catch (error: any) {
        set.status = error.message.includes("not found") ? 404 : 500;
        return errorResponse(error);
      }
    },
    {
      detail: {
        tags: [leaderboardsTag],
        summary: "Obtener jugadores con mas tiros",
      },
    }
  )
  .get(
    "/tournaments/:tournamentId/top-players/aggression",
    async ({ params, query, set }) => {
      try {
        const tournamentId = parseInt(params.tournamentId);
        const viewTypeId = parseInt(query.viewTypeId as string);
        const limit = query.limit ? parseInt(query.limit as string) : 10;

        return await service.getTopPlayersByAggression(tournamentId, viewTypeId, limit);
      } catch (error: any) {
        set.status = error.message.includes("not found") ? 404 : 500;
        return errorResponse(error);
      }
    },
    {
      detail: {
        tags: [leaderboardsTag],
        summary: "Obtener jugadores mas agresivos",
      },
    }
  )
  .get(
    "/tournaments/:tournamentId/top-players/goal-contribution",
    async ({ params, query, set }) => {
      try {
        const tournamentId = parseInt(params.tournamentId);
        const viewTypeId = parseInt(query.viewTypeId as string);
        const limit = query.limit ? parseInt(query.limit as string) : 10;

        return await service.getTopPlayersByGoalContribution(
          tournamentId,
          viewTypeId,
          limit
        );
      } catch (error: any) {
        set.status = error.message.includes("not found") ? 404 : 500;
        return errorResponse(error);
      }
    },
    {
      detail: {
        tags: [leaderboardsTag],
        summary: "Obtener jugadores con mayor contribucion de gol",
      },
    }
  );
