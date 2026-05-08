import { Elysia } from "elysia";

import { ApiSportsModuleError } from "../../sports/domain/api-sports.errors";
import { KickertechModuleError } from "../../kickertech/domain/kickertech.errors";
import { requireAdmin } from "../../../shared/middleware/admin-guard";
import {
  coverageUseCase,
  type CoverageUseCase,
} from "../application/coverage.use-case";
import {
  oddsMappingAdminService,
  type OddsMappingAdminServiceContract,
} from "../application/odds-mapping-admin.service";
import {
  unmappedTournamentsUseCase,
  type UnmappedTournamentsUseCase,
} from "../application/unmapped-tournaments.use-case";
import { OddsIntegrationModuleError } from "../domain/odds-integration.errors";
import {
  coverageQuerySchema,
  idParamSchema,
  unmappedTournamentsQuerySchema,
  upsertTeamAliasBodySchema,
  upsertTournamentMappingBodySchema,
} from "./odds-integration-admin.schemas";

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

const guardOrFail = async (
  set: { status?: number | string },
  request: Request
): Promise<{ ok: true } | { ok: false; response: { error: string } }> => {
  const clerkId = request.headers.get("x-clerk-user-id");
  const guard = await requireAdmin(clerkId);
  if (!guard.ok) {
    set.status = guard.status;
    return { ok: false, response: { error: guard.error } };
  }
  return { ok: true };
};

export interface OddsIntegrationAdminRoutesDeps {
  adminService?: OddsMappingAdminServiceContract;
  unmappedUseCase?: UnmappedTournamentsUseCase;
  coverageUseCase?: CoverageUseCase;
}

export const createOddsIntegrationAdminRoutes = (
  deps: OddsIntegrationAdminRoutesDeps = {}
) => {
  const adminService = deps.adminService ?? oddsMappingAdminService;
  const unmapped = deps.unmappedUseCase ?? unmappedTournamentsUseCase;
  const coverage = deps.coverageUseCase ?? coverageUseCase;

  return new Elysia({ prefix: "/admin/odds" })
    /**
     * Alta o actualización (idempotente) de un mapping torneo↔liga.
     * Único factor de cambio: `apifootballSeason` (null = wildcard).
     */
    .post(
      "/tournaments",
      async ({ body, request, set }) => {
        const guard = await guardOrFail(set, request);
        if (!guard.ok) return guard.response;

        try {
          const verifiedBy = request.headers.get("x-clerk-user-id");
          const result = await adminService.upsertTournamentMapping({
            source: body.source ?? "kickertech",
            sportId: body.sportId,
            countryId: body.countryId,
            tournamentId: body.tournamentId,
            apifootballLeagueId: body.apifootballLeagueId,
            apifootballSeason: body.apifootballSeason,
            status: body.status,
            notes: body.notes ?? null,
            verifiedBy,
          });
          return { data: result };
        } catch (error) {
          return handleError(set, error);
        }
      },
      {
        body: upsertTournamentMappingBodySchema,
        detail: detail("Crear o actualizar mapping torneo↔liga (admin)"),
      }
    )

    .delete(
      "/tournaments/:id",
      async ({ params, request, set }) => {
        const guard = await guardOrFail(set, request);
        if (!guard.ok) return guard.response;

        try {
          await adminService.deleteTournamentMapping(params.id);
          set.status = 204;
          return null;
        } catch (error) {
          return handleError(set, error);
        }
      },
      {
        params: idParamSchema,
        detail: detail("Eliminar mapping de torneo (admin)"),
      }
    )

    /**
     * Alta o actualización (idempotente) de un alias de equipo.
     * El normalized_name se calcula automáticamente.
     */
    .post(
      "/aliases",
      async ({ body, request, set }) => {
        const guard = await guardOrFail(set, request);
        if (!guard.ok) return guard.response;

        try {
          const verifiedBy = request.headers.get("x-clerk-user-id");
          const result = await adminService.upsertTeamAlias({
            source: body.source ?? "kickertech",
            sportId: body.sportId,
            externalName: body.externalName,
            apifootballTeamId: body.apifootballTeamId,
            confidence: body.confidence,
            verifiedBy,
          });
          return { data: result };
        } catch (error) {
          return handleError(set, error);
        }
      },
      {
        body: upsertTeamAliasBodySchema,
        detail: detail("Crear o actualizar alias de equipo (admin)"),
      }
    )

    .delete(
      "/aliases/:id",
      async ({ params, request, set }) => {
        const guard = await guardOrFail(set, request);
        if (!guard.ok) return guard.response;

        try {
          await adminService.deleteTeamAlias(params.id);
          set.status = 204;
          return null;
        } catch (error) {
          return handleError(set, error);
        }
      },
      {
        params: idParamSchema,
        detail: detail("Eliminar alias de equipo (admin)"),
      }
    )

    /**
     * Diagnóstico: torneos de Kickertech sin mapping para un (sport, country),
     * con sugerencias automáticas top-N de leagues de api-football.
     */
    .get(
      "/tournaments/unmapped",
      async ({ query, request, set }) => {
        const guard = await guardOrFail(set, request);
        if (!guard.ok) return guard.response;

        try {
          const items = await unmapped.execute({
            sportId: Number.parseInt(query.sportId, 10),
            countryId: Number.parseInt(query.countryId, 10),
            apifootballCountryName: query.apifootballCountry,
            suggestionsPerTournament: query.topN
              ? Number.parseInt(query.topN, 10)
              : undefined,
          });
          return { data: items };
        } catch (error) {
          return handleError(set, error);
        }
      },
      {
        query: unmappedTournamentsQuerySchema,
        detail: detail("Listar torneos KT sin mapping con sugerencias (admin)"),
      }
    )

    /**
     * Diagnóstico: cobertura de mapping para una liga/fecha.
     * Distingue: ya mapeados | matchearían si se pidiera | no matchean.
     */
    .get(
      "/coverage",
      async ({ query, request, set }) => {
        const guard = await guardOrFail(set, request);
        if (!guard.ok) return guard.response;

        try {
          const report = await coverage.execute({
            leagueId: Number.parseInt(query.leagueId, 10),
            season: Number.parseInt(query.season, 10),
            date: query.date,
          });
          return { data: report };
        } catch (error) {
          return handleError(set, error);
        }
      },
      {
        query: coverageQuerySchema,
        detail: detail("Reporte de cobertura de mapping por liga/fecha (admin)"),
      }
    );
};

export const oddsIntegrationAdminRoutes = createOddsIntegrationAdminRoutes();
