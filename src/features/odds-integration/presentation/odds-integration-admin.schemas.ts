import { t } from "elysia";

export const upsertTournamentMappingBodySchema = t.Object({
  source: t.Optional(t.Literal("kickertech")),
  sportId: t.Number({ minimum: 1 }),
  countryId: t.Number({ minimum: 1 }),
  tournamentId: t.Number({ minimum: 1 }),
  apifootballLeagueId: t.Number({ minimum: 1 }),
  apifootballSeason: t.Union([t.Number({ minimum: 1900 }), t.Null()]),
  status: t.Optional(t.Union([t.Literal("suggested"), t.Literal("confirmed"), t.Literal("rejected")])),
  notes: t.Optional(t.Union([t.String(), t.Null()])),
});

export const upsertTeamAliasBodySchema = t.Object({
  source: t.Optional(t.Literal("kickertech")),
  sportId: t.Number({ minimum: 1 }),
  externalName: t.String({ minLength: 1 }),
  apifootballTeamId: t.Number({ minimum: 1 }),
  confidence: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
});

export const idParamSchema = t.Object({
  id: t.String({ minLength: 1 }),
});

export const unmappedTournamentsQuerySchema = t.Object({
  sportId: t.String({ pattern: "^[0-9]+$" }),
  countryId: t.String({ pattern: "^[0-9]+$" }),
  apifootballCountry: t.String({ minLength: 1 }),
  topN: t.Optional(t.String({ pattern: "^[0-9]+$" })),
});

export const coverageQuerySchema = t.Object({
  leagueId: t.String({ pattern: "^[0-9]+$" }),
  season: t.String({ pattern: "^[0-9]+$" }),
  date: t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" }),
});
