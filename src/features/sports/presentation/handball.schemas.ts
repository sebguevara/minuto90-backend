import { t } from "elysia";

export const handballLeaguesQuerySchema = t.Object({
  id: t.Optional(t.String()),
  name: t.Optional(t.String()),
  country: t.Optional(t.String()),
  season: t.Optional(t.String()),
  search: t.Optional(t.String()),
});

export const handballGamesQuerySchema = t.Object({
  date: t.Optional(t.String()),
  league: t.Optional(t.String()),
  season: t.Optional(t.String()),
  team: t.Optional(t.String()),
  id: t.Optional(t.String()),
  timezone: t.Optional(t.String()),
});

export const handballTeamsQuerySchema = t.Object({
  id: t.Optional(t.String()),
  name: t.Optional(t.String()),
  league: t.Optional(t.String()),
  season: t.Optional(t.String()),
});

export const handballStandingsQuerySchema = t.Object({
  league: t.Optional(t.String()),
  season: t.Optional(t.String()),
  team: t.Optional(t.String()),
});

