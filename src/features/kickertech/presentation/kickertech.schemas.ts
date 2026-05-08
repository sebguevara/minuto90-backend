import { t } from "elysia";

export const kickertechSportIdParamSchema = t.Object({
  sportId: t.String({ pattern: "^[0-9]+$", description: "ID numérico del deporte" }),
});

export const kickertechCountriesParamSchema = t.Object({
  sportId: t.String({ pattern: "^[0-9]+$" }),
});

export const kickertechTournamentsParamSchema = t.Object({
  sportId: t.String({ pattern: "^[0-9]+$" }),
  countryIds: t.String({
    pattern: "^[0-9]+(?:,[0-9]+)*$",
    description: "Uno o varios IDs de país separados por coma (ej: 17 o 17,18,27)",
  }),
});

export const kickertechEventsParamSchema = t.Object({
  sportId: t.String({ pattern: "^[0-9]+$" }),
  countryId: t.String({ pattern: "^[0-9]+$" }),
  tournamentId: t.String({ pattern: "^[0-9]+$" }),
});

export const kickertechEventOddsParamSchema = t.Object({
  sportId: t.String({ pattern: "^[0-9]+$" }),
  eventId: t.String({ pattern: "^[0-9]+$" }),
});

export const kickertechBetslipQuerySchema = t.Object({
  oddId: t.String({ pattern: "^[0-9]+$", description: "ID del odd seleccionado" }),
});
