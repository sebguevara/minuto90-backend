import { Elysia } from "elysia";
import type {
  GetFormula1DriversQuery,
  GetFormula1RacesQuery,
  GetFormula1RankingsQuery,
  GetFormula1TeamsQuery,
} from "../domain/formula1.types";
import {
  formula1Service,
  type Formula1ServiceContract,
} from "../application/formula1.service";
import { formula1ApiClient } from "../infrastructure/formula1-api.client";
import {
  formula1DriversQuerySchema,
  formula1RankingsQuerySchema,
  formula1RacesQuerySchema,
  formula1TeamsQuerySchema,
} from "./formula1.schemas";
import {
  handleApiSportsError,
  parseOptionalInteger,
  parseOptionalString,
  parseRequiredInteger,
} from "./api-sports.route-helpers";
import { createSwaggerDetail, createSwaggerTagDetail } from "./swagger.helpers";
import { formula1SwaggerExamples } from "./multi-sport.swagger.examples";

const toRacesQuery = (query: Record<string, unknown>): GetFormula1RacesQuery => ({
  id: parseOptionalInteger(query.id, "id"),
  competition: parseOptionalInteger(query.competition, "competition"),
  season: parseOptionalInteger(query.season, "season"),
  circuit: parseOptionalInteger(query.circuit, "circuit"),
  type: parseOptionalString(query.type),
});

const toTeamsQuery = (query: Record<string, unknown>): GetFormula1TeamsQuery => ({
  id: parseOptionalInteger(query.id, "id"),
  name: parseOptionalString(query.name),
  search: parseOptionalString(query.search),
});

const toDriversQuery = (query: Record<string, unknown>): GetFormula1DriversQuery => ({
  id: parseOptionalInteger(query.id, "id"),
  name: parseOptionalString(query.name),
  search: parseOptionalString(query.search),
});

const toRankingsQuery = (query: Record<string, unknown>): GetFormula1RankingsQuery => ({
  season: parseRequiredInteger(query.season, "season"),
});

export function createFormula1Routes(
  service: Formula1ServiceContract = formula1Service
) {
  return new Elysia({ prefix: "/formula-1" })
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
          "Formula 1",
          "Obtener temporadas de Formula 1",
          formula1SwaggerExamples.seasons
        ),
      }
    )
    .get(
      "/races",
      async ({ query, set }) => {
        try {
          return await service.getRaces(toRacesQuery(query as Record<string, unknown>));
        } catch (error) {
          return handleApiSportsError(set, error);
        }
      },
      {
        detail: createSwaggerDetail(
          "Formula 1",
          "Obtener carreras de Formula 1",
          formula1SwaggerExamples.races
        ),
        query: formula1RacesQuerySchema,
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
          "Formula 1",
          "Obtener escuderias de Formula 1",
          formula1SwaggerExamples.teams
        ),
        query: formula1TeamsQuerySchema,
      }
    )
    .get(
      "/drivers",
      async ({ query, set }) => {
        try {
          return await service.getDrivers(toDriversQuery(query as Record<string, unknown>));
        } catch (error) {
          return handleApiSportsError(set, error);
        }
      },
      {
        detail: createSwaggerDetail(
          "Formula 1",
          "Obtener pilotos de Formula 1",
          formula1SwaggerExamples.drivers
        ),
        query: formula1DriversQuerySchema,
      }
    )
    .get(
      "/rankings/drivers",
      async ({ query, set }) => {
        try {
          return await service.getDriverRankings(toRankingsQuery(query as Record<string, unknown>));
        } catch (error) {
          return handleApiSportsError(set, error);
        }
      },
      {
        detail: createSwaggerDetail(
          "Formula 1",
          "Obtener ranking de pilotos",
          formula1SwaggerExamples.driverRankings
        ),
        query: formula1RankingsQuerySchema,
      }
    )
    .get(
      "/rankings/teams",
      async ({ query, set }) => {
        try {
          return await service.getTeamRankings(toRankingsQuery(query as Record<string, unknown>));
        } catch (error) {
          return handleApiSportsError(set, error);
        }
      },
      {
        detail: createSwaggerDetail(
          "Formula 1",
          "Obtener ranking de escuderias",
          formula1SwaggerExamples.teamRankings
        ),
        query: formula1RankingsQuerySchema,
      }
    )
    .get("/competitions", async ({ query, set }) => {
      try {
        return await formula1ApiClient.request("/competitions", query as Record<string, unknown>);
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    }, { detail: createSwaggerTagDetail("Formula 1", "Obtener competiciones de Formula 1") })
    .get("/circuits", async ({ query, set }) => {
      try {
        return await formula1ApiClient.request("/circuits", query as Record<string, unknown>);
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    }, { detail: createSwaggerTagDetail("Formula 1", "Obtener circuitos de Formula 1") })
    .get("/rankings/races", async ({ query, set }) => {
      try {
        return await formula1ApiClient.request("/rankings/races", query as Record<string, unknown>);
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    }, { detail: createSwaggerTagDetail("Formula 1", "Obtener ranking de carreras de Formula 1") })
    .get("/rankings/fastestlaps", async ({ query, set }) => {
      try {
        return await formula1ApiClient.request("/rankings/fastestlaps", query as Record<string, unknown>);
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    }, { detail: createSwaggerTagDetail("Formula 1", "Obtener ranking de vueltas rapidas de Formula 1") })
    .get("/rankings/startinggrid", async ({ query, set }) => {
      try {
        return await formula1ApiClient.request("/rankings/startinggrid", query as Record<string, unknown>);
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    }, { detail: createSwaggerTagDetail("Formula 1", "Obtener ranking de grilla de salida de Formula 1") })
    .get("/pitstops", async ({ query, set }) => {
      try {
        return await formula1ApiClient.request("/pitstops", query as Record<string, unknown>);
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    }, { detail: createSwaggerTagDetail("Formula 1", "Obtener pitstops de Formula 1") });
}

export const formula1Routes = createFormula1Routes();
