import { t } from "elysia";

export const formula1RacesQuerySchema = t.Object({
  id: t.Optional(t.String()),
  competition: t.Optional(t.String()),
  season: t.Optional(t.String()),
  circuit: t.Optional(t.String()),
  type: t.Optional(t.String()),
});

export const formula1TeamsQuerySchema = t.Object({
  id: t.Optional(t.String()),
  name: t.Optional(t.String()),
  search: t.Optional(t.String()),
});

export const formula1DriversQuerySchema = t.Object({
  id: t.Optional(t.String()),
  name: t.Optional(t.String()),
  search: t.Optional(t.String()),
});

export const formula1RankingsQuerySchema = t.Object({
  season: t.String(),
});

