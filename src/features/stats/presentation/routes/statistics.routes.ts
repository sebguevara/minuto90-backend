import { Elysia, t } from "elysia";
import * as service from "../../application/statistics.service";
import { errorResponse } from "../helpers/response.helper";

export const statisticsRoutes = new Elysia({ prefix: "/statistics" })
  // ==================== ESTADÍSTICAS DE EQUIPOS ====================

  /**
   * GET /statistics/teams/:tournamentId/summary
   * Obtiene estadísticas resumidas de equipos en un torneo
   * Query params: viewTypeId, categoryId?, sectionId?, limit?, offset?
   */
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
        tags: ["Statistics"],
        summary: "Obtener estadísticas resumidas de equipos",
        description: "Retorna estadísticas de resumen de equipos: goles, tiros, tarjetas, posesión, pases, etc.",
      },
    }
  )

  /**
   * GET /statistics/teams/:tournamentId/defensive
   * Obtiene estadísticas defensivas de equipos en un torneo
   */
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
        tags: ["Statistics"],
        summary: "Obtener estadísticas defensivas de equipos",
        description: "Retorna estadísticas defensivas: tiros pg, tackles pg, intercepciones pg, faltas pg, fueras de juego pg",
      },
    }
  )

  /**
   * GET /statistics/teams/:tournamentId/offensive
   * Obtiene estadísticas ofensivas de equipos en un torneo
   */
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
        tags: ["Statistics"],
        summary: "Obtener estadísticas ofensivas de equipos",
        description: "Retorna estadísticas ofensivas: tiros pg, tiros a portería pg, regates pg, faltas recibidas pg",
      },
    }
  )

  /**
   * GET /statistics/teams/:tournamentId/xg
   * Obtiene estadísticas de xG (Expected Goals) de equipos en un torneo
   */
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
        tags: ["Statistics"],
        summary: "Obtener estadísticas de Expected Goals (xG) de equipos",
        description: "Retorna estadísticas de xG: Expected Goals, goles, diferencia xG, tiros, xG por tiro",
      },
    }
  )

  // ==================== ESTADÍSTICAS DE JUGADORES ====================

  /**
   * GET /statistics/players/:tournamentId/summary
   * Obtiene estadísticas resumidas de jugadores en un torneo
   */
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
        tags: ["Statistics"],
        summary: "Obtener estadísticas resumidas de jugadores",
        description: "Retorna estadísticas de jugadores: goles, asistencias, tarjetas, tiros, pases, duelos aéreos, rating",
      },
    }
  )

  /**
   * GET /statistics/players/:tournamentId/defensive
   * Obtiene estadísticas defensivas de jugadores en un torneo
   */
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
        tags: ["Statistics"],
        summary: "Obtener estadísticas defensivas de jugadores",
        description: "Retorna estadísticas defensivas de jugadores: tackles, intercepciones, faltas, despejes, etc.",
      },
    }
  )

  /**
   * GET /statistics/players/:tournamentId/offensive
   * Obtiene estadísticas ofensivas de jugadores en un torneo
   */
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
        tags: ["Statistics"],
        summary: "Obtener estadísticas ofensivas de jugadores",
        description: "Retorna estadísticas ofensivas de jugadores: tiros, tiros a portería, pases clave, regates, etc.",
      },
    }
  )

  /**
   * GET /statistics/players/:tournamentId/passing
   * Obtiene estadísticas de pases de jugadores en un torneo
   */
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
        tags: ["Statistics"],
        summary: "Obtener estadísticas de pases de jugadores",
        description: "Retorna estadísticas de pases: pases clave, pases totales, precisión, centros, pases largos, etc.",
      },
    }
  )

  /**
   * GET /statistics/players/:tournamentId/xg
   * Obtiene estadísticas de xG de jugadores en un torneo
   */
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
        tags: ["Statistics"],
        summary: "Obtener estadísticas de Expected Goals (xG) de jugadores",
        description: "Retorna estadísticas de xG: xG, npxG, xG assist, xG chain, xG buildup",
      },
    }
  )

  // ==================== RACHAS ====================

  /**
   * GET /statistics/teams/:tournamentId/streaks
   * Obtiene las rachas de equipos en un torneo
   * Query params: viewTypeId, mode? (all/home/away), scope? (Current/Longest), limit?, offset?
   */
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
        tags: ["Statistics"],
        summary: "Obtener rachas de equipos",
        description: "Retorna rachas de equipos: victorias consecutivas, derrotas, empates, etc. Por tipo: victorias, sin perder, sin ganar, derrotas",
      },
    }
  )

  // ==================== RENDIMIENTOS ====================

  /**
   * GET /statistics/teams/:tournamentId/performance
   * Obtiene el rendimiento de equipos en un torneo
   * Query params: viewTypeId, mode? (all/home/away), limit?, offset?
   */
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
        tags: ["Statistics"],
        summary: "Obtener rendimiento de equipos",
        description: "Retorna rendimiento de equipos: partidos jugados, % victorias, % empates, % derrotas, goles a favor/contra por partido, puntos por partido",
      },
    }
  )

  // ==================== XI IDEAL ====================

  /**
   * GET /statistics/tournaments/:tournamentId/best-xi
   * Obtiene el XI ideal de un torneo
   * Query params: timeframe (weekly/monthly/season), startDate?, endDate?
   */
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
        tags: ["Statistics"],
        summary: "Obtener XI ideal del torneo",
        description: "Retorna el once ideal del torneo según el timeframe: semanal (weekly), mensual (monthly) o temporada completa (season)",
      },
    }
  )

  // ==================== TOP PLAYERS (LÍDERES) ====================

  /**
   * GET /statistics/tournaments/:tournamentId/top-players/rating
   * Obtiene los jugadores con mejor rating
   */
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
        tags: ["Statistics"],
        summary: "Obtener jugadores con mejor rating",
        description: "Retorna los jugadores con mejor rating en el torneo",
      },
    }
  )

  /**
   * GET /statistics/tournaments/:tournamentId/top-players/assists
   * Obtiene los jugadores con más asistencias
   */
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
        tags: ["Statistics"],
        summary: "Obtener jugadores con más asistencias",
        description: "Retorna los jugadores con más asistencias en el torneo",
      },
    }
  )

  /**
   * GET /statistics/tournaments/:tournamentId/top-players/shots
   * Obtiene los jugadores con más tiros por partido
   */
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
        tags: ["Statistics"],
        summary: "Obtener jugadores con más tiros",
        description: "Retorna los jugadores con más tiros por partido en el torneo",
      },
    }
  )

  /**
   * GET /statistics/tournaments/:tournamentId/top-players/aggression
   * Obtiene los jugadores más agresivos (tarjetas)
   */
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
        tags: ["Statistics"],
        summary: "Obtener jugadores más agresivos",
        description: "Retorna los jugadores con más tarjetas amarillas y rojas en el torneo",
      },
    }
  )

  /**
   * GET /statistics/tournaments/:tournamentId/top-players/goal-contribution
   * Obtiene los jugadores con mayor contribución de goles
   */
  .get(
    "/tournaments/:tournamentId/top-players/goal-contribution",
    async ({ params, query, set }) => {
      try {
        const tournamentId = parseInt(params.tournamentId);
        const viewTypeId = parseInt(query.viewTypeId as string);
        const limit = query.limit ? parseInt(query.limit as string) : 10;

        return await service.getTopPlayersByGoalContribution(tournamentId, viewTypeId, limit);
      } catch (error: any) {
        set.status = error.message.includes("not found") ? 404 : 500;
        return errorResponse(error);
      }
    },
    {
      detail: {
        tags: ["Statistics"],
        summary: "Obtener jugadores con mayor contribución de goles",
        description: "Retorna los jugadores con mayor porcentaje de contribución a los goles de su equipo",
      },
    }
  );
