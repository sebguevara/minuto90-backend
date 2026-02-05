import { Elysia } from "elysia";
import * as service from "../../application/lookups.service";
import { errorResponse } from "../helpers/response.helper";

export const lookupsRoutes = new Elysia({ prefix: "/lookups" })
  .get("/table-categories", async ({ set }) => {
    try {
      return await service.getTableCategories();
    } catch (error: any) {
      set.status = 500;
      return errorResponse(error);
    }
  })
  .get("/table-sections", async ({ set }) => {
    try {
      return await service.getTableSections();
    } catch (error: any) {
      set.status = 500;
      return errorResponse(error);
    }
  })
  .get("/table-types", async ({ set }) => {
    try {
      return await service.getTableTypes();
    } catch (error: any) {
      set.status = 500;
      return errorResponse(error);
    }
  });

