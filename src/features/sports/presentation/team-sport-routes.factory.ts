import { Elysia } from "elysia";
import { handleApiSportsError } from "./api-sports.route-helpers";
import { createSwaggerDetail } from "./swagger.helpers";

interface TeamSportRoutesService<
  TSeasonsQuery extends object | undefined,
  TLeaguesQuery extends object,
  TGamesQuery extends object,
  TTeamsQuery extends object,
  TStandingsQuery extends object,
> {
  getSeasons(query?: TSeasonsQuery): Promise<unknown>;
  getLeagues(query: TLeaguesQuery): Promise<unknown>;
  getGames(query: TGamesQuery): Promise<unknown>;
  getTeams(query: TTeamsQuery): Promise<unknown>;
  getStandings(query: TStandingsQuery): Promise<unknown>;
}

interface TeamSportRoutesConfig<
  TSeasonsQuery extends object | undefined,
  TLeaguesQuery extends object,
  TGamesQuery extends object,
  TTeamsQuery extends object,
  TStandingsQuery extends object,
> {
  prefix: string;
  tag: string;
  label: string;
  service: TeamSportRoutesService<
    TSeasonsQuery,
    TLeaguesQuery,
    TGamesQuery,
    TTeamsQuery,
    TStandingsQuery
  >;
  seasonsExample: unknown;
  seasonsQuerySchema?: any;
  toSeasonsQuery?: (query: Record<string, unknown>) => TSeasonsQuery;
  leaguesExample: unknown;
  leaguesQuerySchema: any;
  toLeaguesQuery: (query: Record<string, unknown>) => TLeaguesQuery;
  gamesExample: unknown;
  gamesQuerySchema: any;
  toGamesQuery: (query: Record<string, unknown>) => TGamesQuery;
  teamsExample: unknown;
  teamsQuerySchema: any;
  toTeamsQuery: (query: Record<string, unknown>) => TTeamsQuery;
  standingsExample: unknown;
  standingsQuerySchema: any;
  toStandingsQuery: (query: Record<string, unknown>) => TStandingsQuery;
}

export function createTeamSportRoutes<
  TSeasonsQuery extends object | undefined,
  TLeaguesQuery extends object,
  TGamesQuery extends object,
  TTeamsQuery extends object,
  TStandingsQuery extends object,
>(config: TeamSportRoutesConfig<
  TSeasonsQuery,
  TLeaguesQuery,
  TGamesQuery,
  TTeamsQuery,
  TStandingsQuery
>) {
  let app = new Elysia({ prefix: config.prefix });

  if (config.seasonsQuerySchema) {
    app = app.get(
      "/seasons",
      async ({ query, set }) => {
        try {
          return config.toSeasonsQuery
            ? await config.service.getSeasons(
                config.toSeasonsQuery(query as Record<string, unknown>)
              )
            : await config.service.getSeasons();
        } catch (error) {
          return handleApiSportsError(set, error);
        }
      },
      {
        detail: createSwaggerDetail(
          config.tag,
          `Obtener temporadas de ${config.label}`,
          config.seasonsExample
        ),
        query: config.seasonsQuerySchema,
      }
    );
  } else {
    app = app.get(
      "/seasons",
      async ({ set }) => {
        try {
          return await config.service.getSeasons();
        } catch (error) {
          return handleApiSportsError(set, error);
        }
      },
      {
        detail: createSwaggerDetail(
          config.tag,
          `Obtener temporadas de ${config.label}`,
          config.seasonsExample
        ),
      }
    );
  }

  return app
    .get(
      "/leagues",
      async ({ query, set }) => {
        try {
          return await config.service.getLeagues(
            config.toLeaguesQuery(query as Record<string, unknown>)
          );
        } catch (error) {
          return handleApiSportsError(set, error);
        }
      },
      {
        detail: createSwaggerDetail(
          config.tag,
          `Obtener ligas de ${config.label}`,
          config.leaguesExample
        ),
        query: config.leaguesQuerySchema,
      }
    )
    .get(
      "/games",
      async ({ query, set }) => {
        try {
          return await config.service.getGames(config.toGamesQuery(query as Record<string, unknown>));
        } catch (error) {
          return handleApiSportsError(set, error);
        }
      },
      {
        detail: createSwaggerDetail(
          config.tag,
          `Obtener partidos de ${config.label}`,
          config.gamesExample
        ),
        query: config.gamesQuerySchema,
      }
    )
    .get(
      "/teams",
      async ({ query, set }) => {
        try {
          return await config.service.getTeams(config.toTeamsQuery(query as Record<string, unknown>));
        } catch (error) {
          return handleApiSportsError(set, error);
        }
      },
      {
        detail: createSwaggerDetail(
          config.tag,
          `Obtener equipos de ${config.label}`,
          config.teamsExample
        ),
        query: config.teamsQuerySchema,
      }
    )
    .get(
      "/standings",
      async ({ query, set }) => {
        try {
          return await config.service.getStandings(
            config.toStandingsQuery(query as Record<string, unknown>)
          );
        } catch (error) {
          return handleApiSportsError(set, error);
        }
      },
      {
        detail: createSwaggerDetail(
          config.tag,
          `Obtener standings de ${config.label}`,
          config.standingsExample
        ),
        query: config.standingsQuerySchema,
      }
    );
}
