import type {
  GetHandballGamesQuery,
  GetHandballLeaguesQuery,
  GetHandballStandingsQuery,
  GetHandballTeamsQuery,
} from "../domain/handball.types";
import {
  handballService,
  type HandballServiceContract,
} from "../application/handball.service";
import { handballApiClient } from "../infrastructure/handball-api.client";
import {
  handballGamesQuerySchema,
  handballLeaguesQuerySchema,
  handballStandingsQuerySchema,
  handballTeamsQuerySchema,
} from "./handball.schemas";
import { handleApiSportsError, parseOptionalInteger, parseOptionalString } from "./api-sports.route-helpers";
import { createSwaggerTagDetail } from "./swagger.helpers";
import { createTeamSportRoutes } from "./team-sport-routes.factory";
import { handballSwaggerExamples } from "./multi-sport.swagger.examples";

const toLeaguesQuery = (query: Record<string, unknown>): GetHandballLeaguesQuery => ({
  id: parseOptionalInteger(query.id, "id"),
  name: parseOptionalString(query.name),
  country: parseOptionalString(query.country),
  season: parseOptionalInteger(query.season, "season"),
  search: parseOptionalString(query.search),
});

const toGamesQuery = (query: Record<string, unknown>): GetHandballGamesQuery => ({
  date: parseOptionalString(query.date),
  league: parseOptionalInteger(query.league, "league"),
  season: parseOptionalInteger(query.season, "season"),
  team: parseOptionalInteger(query.team, "team"),
  id: parseOptionalInteger(query.id, "id"),
  timezone: parseOptionalString(query.timezone),
});

const toTeamsQuery = (query: Record<string, unknown>): GetHandballTeamsQuery => ({
  id: parseOptionalInteger(query.id, "id"),
  name: parseOptionalString(query.name),
  league: parseOptionalInteger(query.league, "league"),
  season: parseOptionalInteger(query.season, "season"),
});

const toStandingsQuery = (query: Record<string, unknown>): GetHandballStandingsQuery => ({
  league: parseOptionalInteger(query.league, "league"),
  season: parseOptionalInteger(query.season, "season"),
  team: parseOptionalInteger(query.team, "team"),
});

export function createHandballRoutes(
  service: HandballServiceContract = handballService
) {
  return createTeamSportRoutes({
    prefix: "/handball",
    tag: "Handball",
    label: "handball",
    service,
    seasonsExample: handballSwaggerExamples.seasons,
    leaguesQuerySchema: handballLeaguesQuerySchema,
    leaguesExample: handballSwaggerExamples.leagues,
    toLeaguesQuery,
    gamesQuerySchema: handballGamesQuerySchema,
    gamesExample: handballSwaggerExamples.games,
    toGamesQuery,
    teamsQuerySchema: handballTeamsQuerySchema,
    teamsExample: handballSwaggerExamples.teams,
    toTeamsQuery,
    standingsQuerySchema: handballStandingsQuerySchema,
    standingsExample: handballSwaggerExamples.standings,
    toStandingsQuery,
  })
    .get("/countries", async ({ set }) => {
      try {
        return await handballApiClient.request("/countries");
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    }, { detail: createSwaggerTagDetail("Handball", "Obtener paises de handball") })
    .get("/teams/statistics", async ({ query, set }) => {
      try {
        return await handballApiClient.request("/teams/statistics", query as Record<string, unknown>);
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    }, { detail: createSwaggerTagDetail("Handball", "Obtener estadisticas de equipos de handball") })
    .get("/games/h2h", async ({ query, set }) => {
      try {
        return await handballApiClient.request("/games/h2h", query as Record<string, unknown>);
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    }, { detail: createSwaggerTagDetail("Handball", "Obtener head to head de handball") })
    .get("/odds", async ({ query, set }) => {
      try {
        return await handballApiClient.request("/odds", query as Record<string, unknown>);
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    }, { detail: createSwaggerTagDetail("Handball", "Obtener cuotas de handball") });
}

export const handballRoutes = createHandballRoutes();
