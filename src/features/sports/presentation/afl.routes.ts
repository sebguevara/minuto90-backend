import type {
  GetAflGamesQuery,
  GetAflLeaguesQuery,
  GetAflStandingsQuery,
  GetAflTeamsQuery,
} from "../domain/afl.types";
import { aflService, type AflServiceContract } from "../application/afl.service";
import { aflApiClient } from "../infrastructure/afl-api.client";
import {
  aflGamesQuerySchema,
  aflLeaguesQuerySchema,
  aflStandingsQuerySchema,
  aflTeamsQuerySchema,
} from "./afl.schemas";
import { handleApiSportsError, parseOptionalInteger, parseOptionalString } from "./api-sports.route-helpers";
import { createTeamSportRoutes } from "./team-sport-routes.factory";
import { aflSwaggerExamples } from "./multi-sport.swagger.examples";

const toLeaguesQuery = (query: Record<string, unknown>): GetAflLeaguesQuery => ({
  id: parseOptionalInteger(query.id, "id"),
  name: parseOptionalString(query.name),
  country: parseOptionalString(query.country),
  season: parseOptionalInteger(query.season, "season"),
  search: parseOptionalString(query.search),
});

const toGamesQuery = (query: Record<string, unknown>): GetAflGamesQuery => ({
  date: parseOptionalString(query.date),
  league: parseOptionalInteger(query.league, "league"),
  season: parseOptionalInteger(query.season, "season"),
  team: parseOptionalInteger(query.team, "team"),
  id: parseOptionalInteger(query.id, "id"),
  timezone: parseOptionalString(query.timezone),
});

const toTeamsQuery = (query: Record<string, unknown>): GetAflTeamsQuery => ({
  id: parseOptionalInteger(query.id, "id"),
  name: parseOptionalString(query.name),
  league: parseOptionalInteger(query.league, "league"),
  season: parseOptionalInteger(query.season, "season"),
});

const toStandingsQuery = (query: Record<string, unknown>): GetAflStandingsQuery => ({
  league: parseOptionalInteger(query.league, "league"),
  season: parseOptionalInteger(query.season, "season"),
  team: parseOptionalInteger(query.team, "team"),
});

export function createAflRoutes(service: AflServiceContract = aflService) {
  return createTeamSportRoutes({
    prefix: "/afl",
    tag: "AFL",
    label: "AFL",
    service,
    seasonsExample: aflSwaggerExamples.seasons,
    leaguesQuerySchema: aflLeaguesQuerySchema,
    leaguesExample: aflSwaggerExamples.leagues,
    toLeaguesQuery,
    gamesQuerySchema: aflGamesQuerySchema,
    gamesExample: aflSwaggerExamples.games,
    toGamesQuery,
    teamsQuerySchema: aflTeamsQuerySchema,
    teamsExample: aflSwaggerExamples.teams,
    toTeamsQuery,
    standingsQuerySchema: aflStandingsQuerySchema,
    standingsExample: aflSwaggerExamples.standings,
    toStandingsQuery,
  })
    .get("/players", async ({ query, set }) => {
      try {
        return await aflApiClient.request("/players", query as Record<string, unknown>);
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    })
    .get("/games/quarters", async ({ query, set }) => {
      try {
        return await aflApiClient.request("/games/quarters", query as Record<string, unknown>);
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    })
    .get("/games/events", async ({ query, set }) => {
      try {
        return await aflApiClient.request("/games/events", query as Record<string, unknown>);
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    })
    .get("/games/statistics/teams", async ({ query, set }) => {
      try {
        return await aflApiClient.request("/games/statistics/teams", query as Record<string, unknown>);
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    })
    .get("/games/statistics/players", async ({ query, set }) => {
      try {
        return await aflApiClient.request("/games/statistics/players", query as Record<string, unknown>);
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    })
    .get("/players/statistics", async ({ query, set }) => {
      try {
        return await aflApiClient.request("/players/statistics", query as Record<string, unknown>);
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    });
}

export const aflRoutes = createAflRoutes();
