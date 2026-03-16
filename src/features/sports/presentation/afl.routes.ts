import type {
  GetAflGamesQuery,
  GetAflLeaguesQuery,
  GetAflStandingsQuery,
  GetAflTeamsQuery,
} from "../domain/afl.types";
import { aflService, type AflServiceContract } from "../application/afl.service";
import {
  aflGamesQuerySchema,
  aflLeaguesQuerySchema,
  aflStandingsQuerySchema,
  aflTeamsQuerySchema,
} from "./afl.schemas";
import { parseOptionalInteger, parseOptionalString } from "./api-sports.route-helpers";
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
  });
}

export const aflRoutes = createAflRoutes();
