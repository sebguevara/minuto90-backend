import { Elysia, t } from "elysia";
import * as service from "../application/football.service";

export const footballRoutes = new Elysia({ prefix: "/football" })
  /**
   * GET /football/leagues/:leagueId/seasons
   * Obtiene todas las temporadas de una liga, incluyendo la temporada actual
   */
  .get(
    "/leagues/:leagueId/seasons",
    async ({ params, set }) => {
      try {
        const leagueId = parseInt(params.leagueId);
        const data = await service.getLeagueSeasons(leagueId);
        return { data };
      } catch (error: any) {
        set.status = error.message.includes("not found") ? 404 : 500;
        return {
          error: error.message || "Internal server error",
        };
      }
    },
    {
      detail: {
        tags: ["Football"],
        summary: "Obtener temporadas de una liga",
        description:
          "Retorna todas las temporadas de una liga, incluyendo cuál es la temporada actual (current: true)",
      },
    }
  )

  /**
   * GET /football/leagues/:leagueId/current-season
   * Obtiene solo la temporada actual de una liga
   */
  .get(
    "/leagues/:leagueId/current-season",
    async ({ params, set }) => {
      try {
        const leagueId = parseInt(params.leagueId);
        const season = await service.getCurrentSeasonForLeague(leagueId);

        if (!season) {
          set.status = 404;
          return {
            error: "No current season found for this league",
          };
        }

        return { data: season };
      } catch (error: any) {
        set.status = 500;
        return {
          error: error.message || "Internal server error",
        };
      }
    },
    {
      detail: {
        tags: ["Football"],
        summary: "Obtener la temporada actual de una liga",
        description:
          "Retorna únicamente la temporada actual de una liga (la que tiene current: true)",
      },
    }
  )

  /**
   * GET /football/teams/:teamId/last-matches
   * Obtiene los últimos N partidos de un equipo
   */
  .get(
    "/teams/:teamId/last-matches",
    async ({ params, query, set }) => {
      try {
        const teamId = parseInt(params.teamId);
        const leagueId = parseInt(query.leagueId as string);
        const limit = query.limit ? parseInt(query.limit as string) : 5;

        if (!leagueId) {
          set.status = 400;
          return {
            error: "leagueId is required as query parameter",
          };
        }

        const fixtures = await service.getTeamLastMatches(teamId, leagueId, limit);

        return {
          data: fixtures,
          meta: {
            count: fixtures.length,
            limit,
          },
        };
      } catch (error: any) {
        set.status = error.message.includes("not found") ? 404 : 500;
        return {
          error: error.message || "Internal server error",
        };
      }
    },
    {
      detail: {
        tags: ["Football"],
        summary: "Obtener últimos partidos de un equipo",
        description:
          "Retorna los últimos N partidos de un equipo en la temporada actual. Requiere leagueId como query parameter.",
      },
    }
  )

  /**
   * GET /football/teams/:teamId/next-matches
   * Obtiene los próximos N partidos de un equipo
   */
  .get(
    "/teams/:teamId/next-matches",
    async ({ params, query, set }) => {
      try {
        const teamId = parseInt(params.teamId);
        const leagueId = parseInt(query.leagueId as string);
        const limit = query.limit ? parseInt(query.limit as string) : 5;

        if (!leagueId) {
          set.status = 400;
          return {
            error: "leagueId is required as query parameter",
          };
        }

        const fixtures = await service.getTeamNextMatches(teamId, leagueId, limit);

        return {
          data: fixtures,
          meta: {
            count: fixtures.length,
            limit,
          },
        };
      } catch (error: any) {
        set.status = error.message.includes("not found") ? 404 : 500;
        return {
          error: error.message || "Internal server error",
        };
      }
    },
    {
      detail: {
        tags: ["Football"],
        summary: "Obtener próximos partidos de un equipo",
        description:
          "Retorna los próximos N partidos de un equipo en la temporada actual. Requiere leagueId como query parameter.",
      },
    }
  )

  /**
   * GET /football/teams/:teamId/fixtures
   * Obtiene todos los partidos de un equipo en la temporada actual
   */
  .get(
    "/teams/:teamId/fixtures",
    async ({ params, query, set }) => {
      try {
        const teamId = parseInt(params.teamId);
        const leagueId = parseInt(query.leagueId as string);
        const status = query.status as string | undefined;

        if (!leagueId) {
          set.status = 400;
          return {
            error: "leagueId is required as query parameter",
          };
        }

        const result = await service.getTeamFixturesForCurrentSeason(
          teamId,
          leagueId,
          status
        );

        return {
          data: {
            season: result.season,
            fixtures: result.fixtures,
          },
          meta: {
            count: result.fixtures.length,
            season: result.season.year,
          },
        };
      } catch (error: any) {
        set.status = error.message.includes("not found") ? 404 : 500;
        return {
          error: error.message || "Internal server error",
        };
      }
    },
    {
      detail: {
        tags: ["Football"],
        summary: "Obtener todos los partidos de un equipo en la temporada actual",
        description:
          "Retorna todos los partidos de un equipo en la temporada actual. Opcionalmente filtra por status (FT, NS, LIVE, etc.)",
      },
    }
  )

  /**
   * GET /football/fixtures/:fixtureId
   * Obtiene un partido específico por ID
   */
  .get(
    "/fixtures/:fixtureId",
    async ({ params, set }) => {
      try {
        const fixtureId = parseInt(params.fixtureId);
        const fixture = await service.getFixtureById(fixtureId);

        if (!fixture) {
          set.status = 404;
          return {
            error: "Fixture not found",
          };
        }

        return { data: fixture };
      } catch (error: any) {
        set.status = 500;
        return {
          error: error.message || "Internal server error",
        };
      }
    },
    {
      detail: {
        tags: ["Football"],
        summary: "Obtener un partido específico",
        description: "Retorna información detallada de un partido por su ID",
      },
    }
  )

  /**
   * GET /football/teams/:teamId/statistics
   * Obtiene estadísticas de un equipo en la temporada actual
   */
  .get(
    "/teams/:teamId/statistics",
    async ({ params, query, set }) => {
      try {
        const teamId = parseInt(params.teamId);
        const leagueId = parseInt(query.leagueId as string);

        if (!leagueId) {
          set.status = 400;
          return {
            error: "leagueId is required as query parameter",
          };
        }

        const result = await service.getTeamStatisticsForCurrentSeason(teamId, leagueId);

        return {
          data: {
            season: result.season,
            statistics: result.statistics,
          },
        };
      } catch (error: any) {
        set.status = error.message.includes("not found") ? 404 : 500;
        return {
          error: error.message || "Internal server error",
        };
      }
    },
    {
      detail: {
        tags: ["Football"],
        summary: "Obtener estadísticas de un equipo en la temporada actual",
        description:
          "Retorna estadísticas completas de un equipo en la temporada actual de una liga",
      },
    }
  );
