import type {
  GetNbaGamesQuery,
  GetNbaLeaguesQuery,
  GetNbaSeasonsQuery,
  GetNbaStandingsQuery,
  GetNbaTeamsQuery,
} from "../domain/nba.types";
import { nbaService, type NbaServiceContract } from "../application/nba.service";
import {
  nbaGamesQuerySchema,
  nbaLeaguesQuerySchema,
  nbaSeasonsQuerySchema,
  nbaStandingsQuerySchema,
  nbaTeamsQuerySchema,
} from "./nba.schemas";
import { parseOptionalInteger, parseOptionalString } from "./api-sports.route-helpers";
import { createTeamSportRoutes } from "./team-sport-routes.factory";
import { nbaSwaggerExamples } from "./multi-sport.swagger.examples";

const toSeasonsQuery = (query: Record<string, unknown>): GetNbaSeasonsQuery => ({
  search: parseOptionalString(query.search),
});

const toLeaguesQuery = (query: Record<string, unknown>): GetNbaLeaguesQuery => ({
  id: parseOptionalInteger(query.id, "id"),
  name: parseOptionalString(query.name),
  country: parseOptionalString(query.country),
  season: parseOptionalString(query.season),
});

const toGamesQuery = (query: Record<string, unknown>): GetNbaGamesQuery => ({
  date: parseOptionalString(query.date),
  league: parseOptionalInteger(query.league, "league"),
  season: parseOptionalString(query.season),
  team: parseOptionalInteger(query.team, "team"),
  id: parseOptionalInteger(query.id, "id"),
  timezone: parseOptionalString(query.timezone),
});

const toTeamsQuery = (query: Record<string, unknown>): GetNbaTeamsQuery => ({
  id: parseOptionalInteger(query.id, "id"),
  name: parseOptionalString(query.name),
  league: parseOptionalInteger(query.league, "league"),
  season: parseOptionalString(query.season),
  search: parseOptionalString(query.search),
});

const toStandingsQuery = (query: Record<string, unknown>): GetNbaStandingsQuery => ({
  league: parseOptionalInteger(query.league, "league"),
  season: parseOptionalString(query.season),
  team: parseOptionalInteger(query.team, "team"),
});

export function createNbaRoutes(service: NbaServiceContract = nbaService) {
  return createTeamSportRoutes({
    prefix: "/nba",
    tag: "NBA",
    label: "NBA",
    service,
    seasonsQuerySchema: nbaSeasonsQuerySchema,
    seasonsExample: nbaSwaggerExamples.seasons,
    toSeasonsQuery,
    leaguesQuerySchema: nbaLeaguesQuerySchema,
    leaguesExample: nbaSwaggerExamples.leagues,
    toLeaguesQuery,
    gamesQuerySchema: nbaGamesQuerySchema,
    gamesExample: nbaSwaggerExamples.games,
    toGamesQuery,
    teamsQuerySchema: nbaTeamsQuerySchema,
    teamsExample: nbaSwaggerExamples.teams,
    toTeamsQuery,
    standingsQuerySchema: nbaStandingsQuerySchema,
    standingsExample: nbaSwaggerExamples.standings,
    toStandingsQuery,
  });
}

export const nbaRoutes = createNbaRoutes();
