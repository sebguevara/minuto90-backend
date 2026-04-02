import type {
  GetBasketballGamesQuery,
  GetBasketballLeaguesQuery,
  GetBasketballPlayersQuery,
  GetBasketballSeasonsQuery,
  GetBasketballStatisticsQuery,
  GetBasketballStandingsQuery,
  GetBasketballTeamsQuery,
} from "../domain/basketball.types";
import {
  basketballService,
  type BasketballServiceContract,
} from "../application/basketball.service";
import { basketballApiClient } from "../infrastructure/basketball-api.client";
import {
  basketballGamesQuerySchema,
  basketballLeaguesQuerySchema,
  basketballPlayersQuerySchema,
  basketballSeasonsQuerySchema,
  basketballStatisticsQuerySchema,
  basketballStandingsQuerySchema,
  basketballTeamsQuerySchema,
} from "./basketball.schemas";
import {
  handleApiSportsError,
  parseOptionalInteger,
  parseOptionalString,
  parseRequiredInteger,
} from "./api-sports.route-helpers";
import { createSwaggerDetail, createSwaggerTagDetail } from "./swagger.helpers";
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
  country_id: parseOptionalInteger(query.country_id, "country_id"),
});

const toPlayersQuery = (query: Record<string, unknown>): GetBasketballPlayersQuery => ({
  id: parseOptionalInteger(query.id, "id"),
  season: parseOptionalString(query.season),
  team: parseOptionalInteger(query.team, "team"),
  search: parseOptionalString(query.search),
});

const toStatisticsQuery = (
  query: Record<string, unknown>
): GetBasketballStatisticsQuery => ({
  league: parseRequiredInteger(query.league, "league"),
  season: parseOptionalString(query.season) ?? "",
  team: parseRequiredInteger(query.team, "team"),
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
  })
    .get(
      "/players",
      async ({ query, set }) => {
        try {
          return await service.getPlayers(toPlayersQuery(query as Record<string, unknown>));
        } catch (error) {
          return handleApiSportsError(set, error);
        }
      },
      {
        detail: createSwaggerDetail(
          "Basketball",
          "Obtener jugadores de basketball",
          basketballSwaggerExamples.players
        ),
        query: basketballPlayersQuerySchema,
      }
    )
    .get(
      "/statistics",
      async ({ query, set }) => {
        try {
          return await service.getStatistics(toStatisticsQuery(query as Record<string, unknown>));
        } catch (error) {
          return handleApiSportsError(set, error);
        }
      },
      {
        detail: createSwaggerDetail(
          "Basketball",
          "Obtener estadisticas de equipo de basketball",
          basketballSwaggerExamples.statistics
        ),
        query: basketballStatisticsQuerySchema,
      }
    )
    .get("/countries", async ({ set }) => {
      try {
        return await basketballApiClient.request("/countries");
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    }, { detail: createSwaggerTagDetail("Basketball", "Obtener paises de basketball") })
    .get("/standings/stages", async ({ query, set }) => {
      try {
        return await basketballApiClient.request("/standings/stages", query as Record<string, unknown>);
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    }, { detail: createSwaggerTagDetail("Basketball", "Obtener etapas de standings de basketball") })
    .get("/leagues/seasons", async ({ set }) => {
      try {
        return await basketballApiClient.request("/leagues/seasons");
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    }, { detail: createSwaggerTagDetail("Basketball", "Obtener temporadas de ligas de basketball") })
    .get("/games/h2h", async ({ query, set }) => {
      try {
        return await basketballApiClient.request("/games/h2h", query as Record<string, unknown>);
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    }, { detail: createSwaggerTagDetail("Basketball", "Obtener head to head de basketball") })
    .get("/games/statistics/teams", async ({ query, set }) => {
      try {
        return await basketballApiClient.request("/games/statistics/teams", query as Record<string, unknown>);
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    }, { detail: createSwaggerTagDetail("Basketball", "Obtener estadisticas de equipos por partido en basketball") })
    .get("/games/statistics/players", async ({ query, set }) => {
      try {
        return await basketballApiClient.request("/games/statistics/players", query as Record<string, unknown>);
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    }, { detail: createSwaggerTagDetail("Basketball", "Obtener estadisticas de jugadores por partido en basketball") })
    .get("/odds", async ({ query, set }) => {
      try {
        return await basketballApiClient.request("/odds", query as Record<string, unknown>);
      } catch (error) {
        return handleApiSportsError(set, error);
      }
    }, { detail: createSwaggerTagDetail("Basketball", "Obtener cuotas de basketball") });
}

export const basketballRoutes = createBasketballRoutes();
