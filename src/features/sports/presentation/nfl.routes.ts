import type {
  GetNflGamesQuery,
  GetNflLeaguesQuery,
  GetNflStandingsQuery,
  GetNflTeamsQuery,
} from "../domain/nfl.types";
import { nflService, type NflServiceContract } from "../application/nfl.service";
import {
  nflGamesQuerySchema,
  nflLeaguesQuerySchema,
  nflStandingsQuerySchema,
  nflTeamsQuerySchema,
} from "./nfl.schemas";
import { parseOptionalInteger, parseOptionalString } from "./api-sports.route-helpers";
import { createTeamSportRoutes } from "./team-sport-routes.factory";
import { nflSwaggerExamples } from "./multi-sport.swagger.examples";

const toLeaguesQuery = (query: Record<string, unknown>): GetNflLeaguesQuery => ({
  id: parseOptionalInteger(query.id, "id"),
  name: parseOptionalString(query.name),
  country: parseOptionalString(query.country),
  season: parseOptionalInteger(query.season, "season"),
  search: parseOptionalString(query.search),
});

const toGamesQuery = (query: Record<string, unknown>): GetNflGamesQuery => ({
  date: parseOptionalString(query.date),
  league: parseOptionalInteger(query.league, "league"),
  season: parseOptionalInteger(query.season, "season"),
  team: parseOptionalInteger(query.team, "team"),
  id: parseOptionalInteger(query.id, "id"),
  timezone: parseOptionalString(query.timezone),
});

const toTeamsQuery = (query: Record<string, unknown>): GetNflTeamsQuery => ({
  id: parseOptionalInteger(query.id, "id"),
  name: parseOptionalString(query.name),
  league: parseOptionalInteger(query.league, "league"),
  season: parseOptionalInteger(query.season, "season"),
  search: parseOptionalString(query.search),
});

const toStandingsQuery = (query: Record<string, unknown>): GetNflStandingsQuery => ({
  league: parseOptionalInteger(query.league, "league"),
  season: parseOptionalInteger(query.season, "season"),
  team: parseOptionalInteger(query.team, "team"),
});

export function createNflRoutes(service: NflServiceContract = nflService) {
  return createTeamSportRoutes({
    prefix: "/nfl",
    tag: "NFL",
    label: "NFL",
    service,
    seasonsExample: nflSwaggerExamples.seasons,
    leaguesQuerySchema: nflLeaguesQuerySchema,
    leaguesExample: nflSwaggerExamples.leagues,
    toLeaguesQuery,
    gamesQuerySchema: nflGamesQuerySchema,
    gamesExample: nflSwaggerExamples.games,
    toGamesQuery,
    teamsQuerySchema: nflTeamsQuerySchema,
    teamsExample: nflSwaggerExamples.teams,
    toTeamsQuery,
    standingsQuerySchema: nflStandingsQuerySchema,
    standingsExample: nflSwaggerExamples.standings,
    toStandingsQuery,
  });
}

export const nflRoutes = createNflRoutes();
