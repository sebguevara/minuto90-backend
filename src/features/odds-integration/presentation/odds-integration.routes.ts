import { Elysia } from "elysia";

import { ApiSportsModuleError } from "../../sports/domain/api-sports.errors";
import { KickertechModuleError } from "../../kickertech/domain/kickertech.errors";
import {
  oddsLookupUseCase,
  type OddsLookupUseCase,
} from "../application/odds-lookup.use-case";
import {
  OddsIntegrationModuleError,
  createOddsIntegrationValidationError,
} from "../domain/odds-integration.errors";
import {
  betslipQuerySchema,
  fixtureIdParamSchema,
} from "./odds-integration.schemas";

const TAG = "Odds";

const detail = (summary: string) => ({ tags: [TAG], summary });

const handleError = (set: { status?: number | string }, error: unknown) => {
  if (error instanceof OddsIntegrationModuleError) {
    set.status = error.status;
    return { error: error.message, code: error.code };
  }
  if (error instanceof KickertechModuleError) {
    set.status = error.status;
    return { error: error.message, code: error.code };
  }
  if (error instanceof ApiSportsModuleError) {
    set.status = error.status;
    return { error: error.message, code: error.code };
  }
  set.status = 500;
  return { error: "Error interno del servidor", code: "INTERNAL_ERROR" };
};

const parseInt10 = (value: string, field: string): number => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw createOddsIntegrationValidationError(
      `El parámetro ${field} debe ser un número entero válido`
    );
  }
  return parsed;
};

export interface OddsIntegrationRoutesDeps {
  useCase?: OddsLookupUseCase;
}

export const createOddsIntegrationRoutes = (deps: OddsIntegrationRoutesDeps = {}) => {
  const useCase = deps.useCase ?? oddsLookupUseCase;

  return new Elysia({ prefix: "/odds" })
    /**
     * Cuotas unificadas (todos los mercados) por fixture de api-football.
     * Devuelve `{ available: false, reason }` cuando no hay datos — el front
     * debe degradar gracefully.
     */
    .get(
      "/fixture/:fixtureId",
      async ({ params, set }) => {
        try {
          const fixtureId = parseInt10(params.fixtureId, "fixtureId");
          return await useCase.getOdds(fixtureId);
        } catch (error) {
          return handleError(set, error);
        }
      },
      {
        params: fixtureIdParamSchema,
        detail: detail("Cuotas unificadas (todos los mercados) por fixture de api-football"),
      }
    )

    /**
     * Sólo el mercado principal (1X2 / moneyline). Pensado para listados.
     */
    .get(
      "/fixture/:fixtureId/main",
      async ({ params, set }) => {
        try {
          const fixtureId = parseInt10(params.fixtureId, "fixtureId");
          return await useCase.getMainMarket(fixtureId);
        } catch (error) {
          return handleError(set, error);
        }
      },
      {
        params: fixtureIdParamSchema,
        detail: detail("Mercado principal (1X2 / moneyline) del fixture"),
      }
    )

    /**
     * Resolución del betslip de afiliado por fixture + oddId.
     */
    .get(
      "/fixture/:fixtureId/betslip",
      async ({ params, query, set }) => {
        try {
          const fixtureId = parseInt10(params.fixtureId, "fixtureId");
          const oddId = parseInt10(query.oddId, "oddId");
          return await useCase.getBetslip(fixtureId, oddId);
        } catch (error) {
          return handleError(set, error);
        }
      },
      {
        params: fixtureIdParamSchema,
        query: betslipQuerySchema,
        detail: detail("URL del betslip de afiliado para una selección concreta"),
      }
    );
};

export const oddsIntegrationRoutes = createOddsIntegrationRoutes();
