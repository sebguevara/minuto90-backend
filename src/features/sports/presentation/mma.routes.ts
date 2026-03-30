import { Elysia } from "elysia";
import type {
  GetMmaFightersQuery,
  GetMmaFightsQuery,
  GetMmaLeaguesQuery,
} from "../domain/mma.types";
import { mmaService, type MmaServiceContract } from "../application/mma.service";
import { mmaApiClient } from "../infrastructure/mma-api.client";
import {
  mmaFightersQuerySchema,
  mmaFightsQuerySchema,
  mmaLeaguesQuerySchema,
} from "./mma.schemas";
import {
  handleApiSportsError,
  parseOptionalInteger,
  parseOptionalString,
} from "./api-sports.route-helpers";
import { createSwaggerDetail } from "./swagger.helpers";
import { mmaSwaggerExamples } from "./multi-sport.swagger.examples";

const toLeaguesQuery = (query: Record<string, unknown>): GetMmaLeaguesQuery => ({
  id: parseOptionalInteger(query.id, "id"),
  name: parseOptionalString(query.name),
  search: parseOptionalString(query.search),
});

const toFightsQuery = (query: Record<string, unknown>): GetMmaFightsQuery => ({
  date: parseOptionalString(query.date),
  league: parseOptionalInteger(query.league, "league"),
  season: parseOptionalInteger(query.season, "season"),
  id: parseOptionalInteger(query.id, "id"),
  fighter: parseOptionalInteger(query.fighter, "fighter"),
  status: parseOptionalString(query.status),
});

const toFightersQuery = (query: Record<string, unknown>): GetMmaFightersQuery => ({
  id: parseOptionalInteger(query.id, "id"),
  name: parseOptionalString(query.name),
  search: parseOptionalString(query.search),
});

export function createMmaRoutes(service: MmaServiceContract = mmaService) {
  return new Elysia({ prefix: "/mma" })
    .get(
      "/seasons",
      async ({ set }) => {
        try {
          return await service.getSeasons();
        } catch (error) {
          return handleApiSportsError(set, error);
        }
      },
      { detail: createSwaggerDetail("MMA", "Obtener temporadas de MMA", mmaSwaggerExamples.seasons) }
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
        detail: createSwaggerDetail("MMA", "Obtener ligas de MMA", mmaSwaggerExamples.leagues),
        query: mmaLeaguesQuerySchema,
      }
    )
    .get(
      "/fights",
      async ({ query, set }) => {
        try {
          return await service.getFights(toFightsQuery(query as Record<string, unknown>));
        } catch (error) {
          return handleApiSportsError(set, error);
        }
      },
      {
        detail: createSwaggerDetail("MMA", "Obtener peleas de MMA", mmaSwaggerExamples.fights),
        query: mmaFightsQuerySchema,
      }
    )
    .get(
      "/games",
      async ({ query, set }) => {
        try {
          return await service.getFights(toFightsQuery(query as Record<string, unknown>));
        } catch (error) {
          return handleApiSportsError(set, error);
        }
      },
      {
        detail: createSwaggerDetail("MMA", "Alias de peleas de MMA", mmaSwaggerExamples.fights),
        query: mmaFightsQuerySchema,
      }
    )
    .get(
      "/fighters",
      async ({ query, set }) => {
        try {
          return await service.getFighters(toFightersQuery(query as Record<string, unknown>));
        } catch (error) {
          return handleApiSportsError(set, error);
        }
      },
      {
        detail: createSwaggerDetail("MMA", "Obtener peleadores de MMA", mmaSwaggerExamples.fighters),
        query: mmaFightersQuerySchema,
      }
    )
    .get("/teams", async ({ query, set }) => {
      try {
        return await mmaApiClient.request("/teams", query as Record<string, unknown>);
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    })
    .get("/fighters/records", async ({ query, set }) => {
      try {
        return await mmaApiClient.request("/fighters/records", query as Record<string, unknown>);
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    })
    .get("/fights/results", async ({ query, set }) => {
      try {
        return await mmaApiClient.request("/fights/results", query as Record<string, unknown>);
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    })
    .get("/fights/statistics", async ({ query, set }) => {
      try {
        return await mmaApiClient.request("/fights/statistics", query as Record<string, unknown>);
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    });
}

export const mmaRoutes = createMmaRoutes();
