import type {
  GetBaseballGamesQuery,
  GetBaseballLeaguesQuery,
  GetBaseballStandingsQuery,
  GetBaseballTeamsQuery,
} from "../domain/baseball.types";
import {
  baseballService,
  type BaseballServiceContract,
} from "../application/baseball.service";
import { baseballApiClient } from "../infrastructure/baseball-api.client";
import {
  baseballGamesQuerySchema,
  baseballLeaguesQuerySchema,
  baseballStandingsQuerySchema,
  baseballTeamsQuerySchema,
} from "./baseball.schemas";
import { handleApiSportsError, parseOptionalInteger, parseOptionalString } from "./api-sports.route-helpers";
import { createSwaggerTagDetail } from "./swagger.helpers";
import { createTeamSportRoutes } from "./team-sport-routes.factory";
import { baseballSwaggerExamples } from "./multi-sport.swagger.examples";

const toLeaguesQuery = (query: Record<string, unknown>): GetBaseballLeaguesQuery => ({
  id: parseOptionalInteger(query.id, "id"),
  name: parseOptionalString(query.name),
  country: parseOptionalString(query.country),
  season: parseOptionalInteger(query.season, "season"),
});

const toGamesQuery = (query: Record<string, unknown>): GetBaseballGamesQuery => ({
  date: parseOptionalString(query.date),
  league: parseOptionalInteger(query.league, "league"),
  season: parseOptionalInteger(query.season, "season"),
  team: parseOptionalInteger(query.team, "team"),
  id: parseOptionalInteger(query.id, "id"),
  timezone: parseOptionalString(query.timezone),
});

const toTeamsQuery = (query: Record<string, unknown>): GetBaseballTeamsQuery => ({
  id: parseOptionalInteger(query.id, "id"),
  name: parseOptionalString(query.name),
  league: parseOptionalInteger(query.league, "league"),
  season: parseOptionalInteger(query.season, "season"),
  country_id: parseOptionalInteger(query.country_id, "country_id"),
});

const toStandingsQuery = (query: Record<string, unknown>): GetBaseballStandingsQuery => ({
  league: parseOptionalInteger(query.league, "league"),
  season: parseOptionalInteger(query.season, "season"),
  team: parseOptionalInteger(query.team, "team"),
});

export function createBaseballRoutes(
  service: BaseballServiceContract = baseballService
) {
  return createTeamSportRoutes({
    prefix: "/baseball",
    tag: "Baseball",
    label: "baseball",
    service,
    seasonsExample: baseballSwaggerExamples.seasons,
    leaguesQuerySchema: baseballLeaguesQuerySchema,
    leaguesExample: baseballSwaggerExamples.leagues,
    toLeaguesQuery,
    gamesQuerySchema: baseballGamesQuerySchema,
    gamesExample: baseballSwaggerExamples.games,
    toGamesQuery,
    teamsQuerySchema: baseballTeamsQuerySchema,
    teamsExample: baseballSwaggerExamples.teams,
    toTeamsQuery,
    standingsQuerySchema: baseballStandingsQuerySchema,
    standingsExample: baseballSwaggerExamples.standings,
    toStandingsQuery,
  })
    .get("/countries", async ({ set }) => {
      try {
        return await baseballApiClient.request("/countries");
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    }, { detail: createSwaggerTagDetail("Baseball", "Obtener paises de baseball") })
    .get("/teams/statistics", async ({ query, set }) => {
      try {
        return await baseballApiClient.request("/teams/statistics", query as Record<string, unknown>);
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    }, { detail: createSwaggerTagDetail("Baseball", "Obtener estadisticas de equipos de baseball") })
    .get("/games/h2h", async ({ query, set }) => {
      try {
        return await baseballApiClient.request("/games/h2h", query as Record<string, unknown>);
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    }, { detail: createSwaggerTagDetail("Baseball", "Obtener head to head de baseball") })
    .get("/odds", async ({ query, set }) => {
      try {
        return await baseballApiClient.request("/odds", query as Record<string, unknown>);
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    }, { detail: createSwaggerTagDetail("Baseball", "Obtener cuotas de baseball") });
}

export const baseballRoutes = createBaseballRoutes();
