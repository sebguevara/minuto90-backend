import { t } from "elysia";

export const nflLeaguesQuerySchema = t.Object({
  id: t.Optional(t.String()),
  name: t.Optional(t.String()),
  country: t.Optional(t.String()),
  season: t.Optional(t.String()),
  search: t.Optional(t.String()),
});

export const nflGamesQuerySchema = t.Object({
  date: t.Optional(t.String()),
  league: t.Optional(t.String()),
  season: t.Optional(t.String()),
  team: t.Optional(t.String()),
  id: t.Optional(t.String()),
  timezone: t.Optional(t.String()),
});

export const nflTeamsQuerySchema = t.Object({
  id: t.Optional(t.String()),
  name: t.Optional(t.String()),
  league: t.Optional(t.String()),
  season: t.Optional(t.String()),
  search: t.Optional(t.String()),
});

export const nflStandingsQuerySchema = t.Object({
  league: t.Optional(t.String()),
  season: t.Optional(t.String()),
  team: t.Optional(t.String()),
});

