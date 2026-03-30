import type {
  GetHockeyGamesQuery,
  GetHockeyLeaguesQuery,
  GetHockeyStandingsQuery,
  GetHockeyTeamsQuery,
} from "../domain/hockey.types";
import { hockeyService, type HockeyServiceContract } from "../application/hockey.service";
import { hockeyApiClient } from "../infrastructure/hockey-api.client";
import {
  hockeyGamesQuerySchema,
  hockeyLeaguesQuerySchema,
  hockeyStandingsQuerySchema,
  hockeyTeamsQuerySchema,
} from "./hockey.schemas";
import { handleApiSportsError, parseOptionalInteger, parseOptionalString } from "./api-sports.route-helpers";
import { createTeamSportRoutes } from "./team-sport-routes.factory";
import { hockeySwaggerExamples } from "./multi-sport.swagger.examples";

const toLeaguesQuery = (query: Record<string, unknown>): GetHockeyLeaguesQuery => ({
  id: parseOptionalInteger(query.id, "id"),
  name: parseOptionalString(query.name),
  country: parseOptionalString(query.country),
  season: parseOptionalInteger(query.season, "season"),
});

const toGamesQuery = (query: Record<string, unknown>): GetHockeyGamesQuery => ({
  date: parseOptionalString(query.date),
  league: parseOptionalInteger(query.league, "league"),
  season: parseOptionalInteger(query.season, "season"),
  team: parseOptionalInteger(query.team, "team"),
  id: parseOptionalInteger(query.id, "id"),
  timezone: parseOptionalString(query.timezone),
});

const toTeamsQuery = (query: Record<string, unknown>): GetHockeyTeamsQuery => ({
  id: parseOptionalInteger(query.id, "id"),
  name: parseOptionalString(query.name),
  league: parseOptionalInteger(query.league, "league"),
  season: parseOptionalInteger(query.season, "season"),
});

const toStandingsQuery = (query: Record<string, unknown>): GetHockeyStandingsQuery => ({
  league: parseOptionalInteger(query.league, "league"),
  season: parseOptionalInteger(query.season, "season"),
  team: parseOptionalInteger(query.team, "team"),
});

export function createHockeyRoutes(service: HockeyServiceContract = hockeyService) {
  return createTeamSportRoutes({
    prefix: "/hockey",
    tag: "Hockey",
    label: "hockey",
    service,
    seasonsExample: hockeySwaggerExamples.seasons,
    leaguesQuerySchema: hockeyLeaguesQuerySchema,
    leaguesExample: hockeySwaggerExamples.leagues,
    toLeaguesQuery,
    gamesQuerySchema: hockeyGamesQuerySchema,
    gamesExample: hockeySwaggerExamples.games,
    toGamesQuery,
    teamsQuerySchema: hockeyTeamsQuerySchema,
    teamsExample: hockeySwaggerExamples.teams,
    toTeamsQuery,
    standingsQuerySchema: hockeyStandingsQuerySchema,
    standingsExample: hockeySwaggerExamples.standings,
    toStandingsQuery,
  })
    .get("/countries", async ({ set }) => {
      try {
        return await hockeyApiClient.request("/countries");
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    })
    .get("/teams/statistics", async ({ query, set }) => {
      try {
        return await hockeyApiClient.request("/teams/statistics", query as Record<string, unknown>);
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    })
    .get("/games/h2h", async ({ query, set }) => {
      try {
        return await hockeyApiClient.request("/games/h2h", query as Record<string, unknown>);
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    })
    .get("/odds", async ({ query, set }) => {
      try {
        return await hockeyApiClient.request("/odds", query as Record<string, unknown>);
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    });
}

export const hockeyRoutes = createHockeyRoutes();
