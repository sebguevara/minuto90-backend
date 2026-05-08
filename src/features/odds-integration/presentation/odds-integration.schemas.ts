import { t } from "elysia";

export const fixtureIdParamSchema = t.Object({
  fixtureId: t.String({ pattern: "^[0-9]+$", description: "ID de fixture de api-football" }),
});

export const betslipQuerySchema = t.Object({
  oddId: t.String({ pattern: "^[0-9]+$", description: "ID del odd seleccionado" }),
});
