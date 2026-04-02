import { Elysia } from "elysia";
import type {
  GetVolleyballGamesQuery,
  GetVolleyballLeaguesQuery,
  GetVolleyballStandingsQuery,
  GetVolleyballTeamsQuery,
} from "../domain/volleyball.types";
import {
  volleyballService,
  type VolleyballServiceContract,
} from "../application/volleyball.service";
import { volleyballApiClient } from "../infrastructure/volleyball-api.client";
import {
  volleyballGamesQuerySchema,
  volleyballLeaguesQuerySchema,
  volleyballStandingsQuerySchema,
  volleyballTeamsQuerySchema,
} from "./volleyball.schemas";
import {
  handleApiSportsError,
  parseOptionalInteger,
  parseOptionalString,
} from "./api-sports.route-helpers";
import { createSwaggerDetail, createSwaggerTagDetail } from "./swagger.helpers";
import { volleyballSwaggerExamples } from "./multi-sport.swagger.examples";

function toLeaguesQuery(query: Record<string, unknown>): GetVolleyballLeaguesQuery {
  return {
    id: parseOptionalInteger(query.id, "id"),
    name: parseOptionalString(query.name),
    country: parseOptionalString(query.country),
    season: parseOptionalInteger(query.season, "season"),
    search: parseOptionalString(query.search),
  };
}

function toGamesQuery(query: Record<string, unknown>): GetVolleyballGamesQuery {
  return {
    date: parseOptionalString(query.date),
    league: parseOptionalInteger(query.league, "league"),
    season: parseOptionalInteger(query.season, "season"),
    team: parseOptionalInteger(query.team, "team"),
    id: parseOptionalInteger(query.id, "id"),
    timezone: parseOptionalString(query.timezone),
  };
}

function toTeamsQuery(query: Record<string, unknown>): GetVolleyballTeamsQuery {
  return {
    id: parseOptionalInteger(query.id, "id"),
    name: parseOptionalString(query.name),
    league: parseOptionalInteger(query.league, "league"),
    season: parseOptionalInteger(query.season, "season"),
  };
}

function toStandingsQuery(query: Record<string, unknown>): GetVolleyballStandingsQuery {
  return {
    league: parseOptionalInteger(query.league, "league"),
    season: parseOptionalInteger(query.season, "season"),
    team: parseOptionalInteger(query.team, "team"),
  };
}

export function createVolleyballRoutes(service: VolleyballServiceContract = volleyballService) {
  return new Elysia({ prefix: "/volleyball" })
    .get(
      "/seasons",
      async ({ set }) => {
        try {
          return await service.getSeasons();
        } catch (error) {
          return handleApiSportsError(set, error);
        }
      },
      {
        detail: createSwaggerDetail(
          "Volleyball",
          "Obtener temporadas de volleyball",
          volleyballSwaggerExamples.seasons
        ),
      }
    )
    .get(
      "/leagues",
      async ({ query, set }) => {
        try {
          return await service.getLeagues(toLeaguesQuery(query as Record<string, unknown>));
        } catch (error) {
          return handleApiSportsError(set, error);
        }
      },
      {
        detail: createSwaggerDetail(
          "Volleyball",
          "Obtener ligas de volleyball",
          volleyballSwaggerExamples.leagues
        ),
        query: volleyballLeaguesQuerySchema,
      }
    )
    .get(
      "/games",
      async ({ query, set }) => {
        try {
          return await service.getGames(toGamesQuery(query as Record<string, unknown>));
        } catch (error) {
          return handleApiSportsError(set, error);
        }
      },
      {
        detail: createSwaggerDetail(
          "Volleyball",
          "Obtener partidos de volleyball",
          volleyballSwaggerExamples.games
        ),
        query: volleyballGamesQuerySchema,
      }
    )
    .get(
      "/teams",
      async ({ query, set }) => {
        try {
          return await service.getTeams(toTeamsQuery(query as Record<string, unknown>));
        } catch (error) {
          return handleApiSportsError(set, error);
        }
      },
      {
        detail: createSwaggerDetail(
          "Volleyball",
          "Obtener equipos de volleyball",
          volleyballSwaggerExamples.teams
        ),
        query: volleyballTeamsQuerySchema,
      }
    )
    .get(
      "/standings",
      async ({ query, set }) => {
        try {
          return await service.getStandings(toStandingsQuery(query as Record<string, unknown>));
        } catch (error) {
          return handleApiSportsError(set, error);
        }
      },
      {
        detail: createSwaggerDetail(
          "Volleyball",
          "Obtener standings de volleyball",
          volleyballSwaggerExamples.standings
        ),
        query: volleyballStandingsQuerySchema,
      }
    )
    .get("/countries", async ({ set }) => {
      try {
        return await volleyballApiClient.request("/countries");
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    }, { detail: createSwaggerTagDetail("Volleyball", "Obtener paises de volleyball") })
    .get("/teams/statistics", async ({ query, set }) => {
      try {
        return await volleyballApiClient.request("/teams/statistics", query as Record<string, unknown>);
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    }, { detail: createSwaggerTagDetail("Volleyball", "Obtener estadisticas de equipos de volleyball") })
    .get("/games/h2h", async ({ query, set }) => {
      try {
        return await volleyballApiClient.request("/games/h2h", query as Record<string, unknown>);
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    }, { detail: createSwaggerTagDetail("Volleyball", "Obtener head to head de volleyball") })
    .get("/odds", async ({ query, set }) => {
      try {
        return await volleyballApiClient.request("/odds", query as Record<string, unknown>);
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    }, { detail: createSwaggerTagDetail("Volleyball", "Obtener cuotas de volleyball") });
}

export const volleyballRoutes = createVolleyballRoutes();
