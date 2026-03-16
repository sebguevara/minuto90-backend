import { t } from "elysia";

export const mmaLeaguesQuerySchema = t.Object({
  id: t.Optional(t.String()),
  name: t.Optional(t.String()),
  search: t.Optional(t.String()),
});

export const mmaFightsQuerySchema = t.Object({
  date: t.Optional(t.String()),
  league: t.Optional(t.String()),
  season: t.Optional(t.String()),
  id: t.Optional(t.String()),
  fighter: t.Optional(t.String()),
  status: t.Optional(t.String()),
});

export const mmaFightersQuerySchema = t.Object({
  id: t.Optional(t.String()),
  name: t.Optional(t.String()),
  search: t.Optional(t.String()),
});

