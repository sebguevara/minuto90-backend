import { Elysia } from "elysia";
import * as service from "../../application/lookups.service";
import { errorResponse } from "../helpers/response.helper";

const tag = "Stats";

export const lookupsRoutes = new Elysia({ prefix: "/lookups" })
  .get(
    "/table-categories",
    async ({ set }) => {
      try {
        return await service.getTableCategories();
      } catch (error: any) {
        set.status = 500;
        return errorResponse(error);
      }
    },
    {
      detail: {
        tags: [tag],
        summary: "Obtener categorias de tabla",
      },
    }
  )
  .get(
    "/table-sections",
    async ({ set }) => {
      try {
        return await service.getTableSections();
      } catch (error: any) {
        set.status = 500;
        return errorResponse(error);
      }
    },
    {
      detail: {
        tags: [tag],
        summary: "Obtener secciones de tabla",
      },
    }
  )
  .get(
    "/table-types",
    async ({ set }) => {
      try {
        return await service.getTableTypes();
      } catch (error: any) {
        set.status = 500;
        return errorResponse(error);
      }
    },
    {
      detail: {
        tags: [tag],
        summary: "Obtener tipos de tabla",
      },
    }
  );
