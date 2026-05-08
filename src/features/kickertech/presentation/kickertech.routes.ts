import { Elysia } from "elysia";

import {
  kickertechBetslipService,
  type KickertechBetslipServiceContract,
} from "../application/kickertech-betslip.service";
import {
  kickertechDiscoveryService,
  type KickertechDiscoveryServiceContract,
} from "../application/kickertech-discovery.service";
import {
  kickertechOddsService,
  type KickertechOddsServiceContract,
} from "../application/kickertech-odds.service";
import {
  KickertechModuleError,
  createKickertechValidationError,
} from "../domain/kickertech.errors";
import {
  kickertechBetslipQuerySchema,
  kickertechCountriesParamSchema,
  kickertechEventOddsParamSchema,
  kickertechEventsParamSchema,
  kickertechSportIdParamSchema,
  kickertechTournamentsParamSchema,
} from "./kickertech.schemas";

const TAG = "Kickertech";

const detail = (summary: string) => ({ tags: [TAG], summary });

const handleError = (set: { status?: number | string }, error: unknown) => {
  if (error instanceof KickertechModuleError) {
    set.status = error.status;
    return { error: error.message, code: error.code };
  }
  set.status = 500;
  return { error: "Error interno del servidor", code: "INTERNAL_ERROR" };
};

const parseInt10 = (value: string, field: string): number => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw createKickertechValidationError(`El parámetro ${field} debe ser un número entero válido`);
  }
  return parsed;
};

const parseCountryIds = (raw: string): number[] => {
  const ids = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => parseInt10(value, "countryIds"));
  if (!ids.length) {
    throw createKickertechValidationError("El parámetro countryIds es obligatorio");
  }
  return ids;
};

export interface KickertechRoutesDependencies {
  discoveryService?: KickertechDiscoveryServiceContract;
  oddsService?: KickertechOddsServiceContract;
  betslipService?: KickertechBetslipServiceContract;
}

export const createKickertechRoutes = (deps: KickertechRoutesDependencies = {}) => {
  const discovery = deps.discoveryService ?? kickertechDiscoveryService;
  const odds = deps.oddsService ?? kickertechOddsService;
  const betslip = deps.betslipService ?? kickertechBetslipService;

  return new Elysia({ prefix: "/kickertech" })
    /**
     * Catálogo: deportes disponibles en Kickertech.
     * TTL Redis ~24h. Para frontend que arma menú de deportes con cuotas.
     */
    .get(
      "/sports",
      async ({ set }) => {
        try {
          return await discovery.getSports();
        } catch (error) {
          return handleError(set, error);
        }
      },
      { detail: detail("Listado de deportes con cuotas disponibles") }
    )

    /**
     * Catálogo: países/regiones por deporte. TTL ~12h.
     */
    .get(
      "/sports/:sportId/countries",
      async ({ params, set }) => {
        try {
          const sportId = parseInt10(params.sportId, "sportId");
          return await discovery.getCountries(sportId);
        } catch (error) {
          return handleError(set, error);
        }
      },
      {
        params: kickertechCountriesParamSchema,
        detail: detail("Países disponibles en un deporte"),
      }
    )

    /**
     * Catálogo: torneos por deporte y uno o varios países. TTL ~6h.
     * Soporta `countryIds` separados por coma (ej: "17,18,27").
     */
    .get(
      "/sports/:sportId/countries/:countryIds/tournaments",
      async ({ params, set }) => {
        try {
          const sportId = parseInt10(params.sportId, "sportId");
          const countryIds = parseCountryIds(params.countryIds);
          return await discovery.getTournaments(sportId, countryIds);
        } catch (error) {
          return handleError(set, error);
        }
      },
      {
        params: kickertechTournamentsParamSchema,
        detail: detail("Torneos por país (admite varios países separados por coma)"),
      }
    )

    /**
     * Listado de eventos (ligero, sin mercados). TTL ~10 min.
     * Se usa para construir grids y para matchear contra fixtures de api-football.
     */
    .get(
      "/sports/:sportId/countries/:countryIds/tournaments/:tournamentId/events",
      async ({ params, set }) => {
        try {
          const sportId = parseInt10(params.sportId, "sportId");
          const countryId = parseInt10(params.countryIds, "countryId");
          const tournamentId = parseInt10(params.tournamentId, "tournamentId");
          return await discovery.getEvents(sportId, countryId, tournamentId);
        } catch (error) {
          return handleError(set, error);
        }
      },
      {
        params: kickertechEventsParamSchema,
        detail: detail("Eventos (con cuotas activas) de un torneo"),
      }
    )

    /**
     * Feed completo del deporte: todos los eventos con todos sus mercados y odds.
     * TTL: 30s en live, 3 min en prematch. Pesado — para el frontend usar mejor
     * el endpoint por evento si sólo se necesita uno.
     */
    .get(
      "/sports/:sportId/feed",
      async ({ params, set }) => {
        try {
          const sportId = parseInt10(params.sportId, "sportId");
          return await odds.getSportFeed(sportId);
        } catch (error) {
          return handleError(set, error);
        }
      },
      {
        params: kickertechSportIdParamSchema,
        detail: detail("Feed completo de cuotas de un deporte"),
      }
    )

    /**
     * Catálogo de tipos de mercado (resuelve type_id → nombre legible).
     */
    .get(
      "/sports/:sportId/markets-catalog",
      async ({ params, set }) => {
        try {
          const sportId = parseInt10(params.sportId, "sportId");
          return await odds.getMarketsCatalog(sportId);
        } catch (error) {
          return handleError(set, error);
        }
      },
      {
        params: kickertechSportIdParamSchema,
        detail: detail("Catálogo de tipos de mercado de un deporte"),
      }
    )

    /**
     * Cuotas detalladas de un evento (todos los mercados + odds + betslip).
     */
    .get(
      "/sports/:sportId/events/:eventId/odds",
      async ({ params, set }) => {
        try {
          const sportId = parseInt10(params.sportId, "sportId");
          const eventId = parseInt10(params.eventId, "eventId");
          return await odds.getEventOdds(sportId, eventId);
        } catch (error) {
          return handleError(set, error);
        }
      },
      {
        params: kickertechEventOddsParamSchema,
        detail: detail("Cuotas detalladas de un evento"),
      }
    )

    /**
     * Resolución del betslip de afiliado: dado un `oddId` válido del evento,
     * devuelve la URL final lista para abrir en el sportsbook de Kickertech.
     */
    .get(
      "/sports/:sportId/events/:eventId/betslip",
      async ({ params, query, set }) => {
        try {
          const sportId = parseInt10(params.sportId, "sportId");
          const eventId = parseInt10(params.eventId, "eventId");
          const oddId = parseInt10(query.oddId, "oddId");
          return await betslip.resolveBetslip({ sportId, eventId, oddId });
        } catch (error) {
          return handleError(set, error);
        }
      },
      {
        params: kickertechEventOddsParamSchema,
        query: kickertechBetslipQuerySchema,
        detail: detail("Resuelve la URL del betslip de afiliado para una selección"),
      }
    );
};

export const kickertechRoutes = createKickertechRoutes();
