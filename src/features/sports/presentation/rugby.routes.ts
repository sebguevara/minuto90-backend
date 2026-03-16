import { Elysia } from "elysia";
import type {
  GetRugbyGamesQuery,
  GetRugbyLeaguesQuery,
  GetRugbyStandingsQuery,
  GetRugbyTeamsQuery,
} from "../domain/rugby.types";
import { rugbyService, type RugbyServiceContract } from "../application/rugby.service";
import {
  rugbyGamesQuerySchema,
  rugbyLeaguesQuerySchema,
  rugbyStandingsQuerySchema,
  rugbyTeamsQuerySchema,
} from "./rugby.schemas";
import {
  handleApiSportsError,
  parseOptionalInteger,
  parseOptionalString,
} from "./api-sports.route-helpers";
import { createSwaggerDetail } from "./swagger.helpers";
import { rugbySwaggerExamples } from "./multi-sport.swagger.examples";

function toLeaguesQuery(query: Record<string, unknown>): GetRugbyLeaguesQuery {
  return {
    id: parseOptionalInteger(query.id, "id"),
    name: parseOptionalString(query.name),
    country: parseOptionalString(query.country),
    season: parseOptionalInteger(query.season, "season"),
  };
}

function toGamesQuery(query: Record<string, unknown>): GetRugbyGamesQuery {
  return {
    date: parseOptionalString(query.date),
    league: parseOptionalInteger(query.league, "league"),
    season: parseOptionalInteger(query.season, "season"),
    team: parseOptionalInteger(query.team, "team"),
    id: parseOptionalInteger(query.id, "id"),
    timezone: parseOptionalString(query.timezone),
  };
}

function toTeamsQuery(query: Record<string, unknown>): GetRugbyTeamsQuery {
  return {
    id: parseOptionalInteger(query.id, "id"),
    name: parseOptionalString(query.name),
    league: parseOptionalInteger(query.league, "league"),
    season: parseOptionalInteger(query.season, "season"),
  };
}

function toStandingsQuery(query: Record<string, unknown>): GetRugbyStandingsQuery {
  return {
    league: parseOptionalInteger(query.league, "league"),
    season: parseOptionalInteger(query.season, "season"),
    team: parseOptionalInteger(query.team, "team"),
  };
}

export function createRugbyRoutes(service: RugbyServiceContract = rugbyService) {
  return new Elysia({ prefix: "/rugby" })
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
        detail: createSwaggerDetail("Rugby", "Obtener temporadas de rugby", rugbySwaggerExamples.seasons),
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
        detail: createSwaggerDetail("Rugby", "Obtener ligas de rugby", rugbySwaggerExamples.leagues),
        query: rugbyLeaguesQuerySchema,
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
        detail: createSwaggerDetail("Rugby", "Obtener partidos de rugby", rugbySwaggerExamples.games),
        query: rugbyGamesQuerySchema,
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
        detail: createSwaggerDetail("Rugby", "Obtener equipos de rugby", rugbySwaggerExamples.teams),
        query: rugbyTeamsQuerySchema,
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
          "Rugby",
          "Obtener standings de rugby",
          rugbySwaggerExamples.standings
        ),
        query: rugbyStandingsQuerySchema,
      }
    );
}

export const rugbyRoutes = createRugbyRoutes();
