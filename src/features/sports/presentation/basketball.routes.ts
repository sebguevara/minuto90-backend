import type {
  GetBasketballGamesQuery,
  GetBasketballLeaguesQuery,
  GetBasketballSeasonsQuery,
  GetBasketballStandingsQuery,
  GetBasketballTeamsQuery,
} from "../domain/basketball.types";
import {
  basketballService,
  type BasketballServiceContract,
} from "../application/basketball.service";
import {
  basketballGamesQuerySchema,
  basketballLeaguesQuerySchema,
  basketballSeasonsQuerySchema,
  basketballStandingsQuerySchema,
  basketballTeamsQuerySchema,
} from "./basketball.schemas";
import { parseOptionalInteger, parseOptionalString } from "./api-sports.route-helpers";
import { createTeamSportRoutes } from "./team-sport-routes.factory";
import { basketballSwaggerExamples } from "./multi-sport.swagger.examples";

const toSeasonsQuery = (query: Record<string, unknown>): GetBasketballSeasonsQuery => ({
  search: parseOptionalString(query.search),
});

const toLeaguesQuery = (query: Record<string, unknown>): GetBasketballLeaguesQuery => ({
  id: parseOptionalInteger(query.id, "id"),
  name: parseOptionalString(query.name),
  country: parseOptionalString(query.country),
  season: parseOptionalString(query.season),
});

const toGamesQuery = (query: Record<string, unknown>): GetBasketballGamesQuery => ({
  date: parseOptionalString(query.date),
  league: parseOptionalInteger(query.league, "league"),
  season: parseOptionalString(query.season),
  team: parseOptionalInteger(query.team, "team"),
  id: parseOptionalInteger(query.id, "id"),
  timezone: parseOptionalString(query.timezone),
});

const toTeamsQuery = (query: Record<string, unknown>): GetBasketballTeamsQuery => ({
  id: parseOptionalInteger(query.id, "id"),
  name: parseOptionalString(query.name),
  league: parseOptionalInteger(query.league, "league"),
  season: parseOptionalString(query.season),
  search: parseOptionalString(query.search),
});

const toStandingsQuery = (query: Record<string, unknown>): GetBasketballStandingsQuery => ({
  league: parseOptionalInteger(query.league, "league"),
  season: parseOptionalString(query.season),
  team: parseOptionalInteger(query.team, "team"),
});

export function createBasketballRoutes(
  service: BasketballServiceContract = basketballService
) {
  return createTeamSportRoutes({
    prefix: "/basketball",
    tag: "Basketball",
    label: "basketball",
    service,
    seasonsQuerySchema: basketballSeasonsQuerySchema,
    seasonsExample: basketballSwaggerExamples.seasons,
    toSeasonsQuery,
    leaguesQuerySchema: basketballLeaguesQuerySchema,
    leaguesExample: basketballSwaggerExamples.leagues,
    toLeaguesQuery,
    gamesQuerySchema: basketballGamesQuerySchema,
    gamesExample: basketballSwaggerExamples.games,
    toGamesQuery,
    teamsQuerySchema: basketballTeamsQuerySchema,
    teamsExample: basketballSwaggerExamples.teams,
    toTeamsQuery,
    standingsQuerySchema: basketballStandingsQuerySchema,
    standingsExample: basketballSwaggerExamples.standings,
    toStandingsQuery,
  });
}

export const basketballRoutes = createBasketballRoutes();
