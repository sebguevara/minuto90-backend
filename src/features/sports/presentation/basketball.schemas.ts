import { t } from "elysia";

export const basketballSeasonsQuerySchema = t.Object({
  search: t.Optional(t.String()),
});

export const basketballLeaguesQuerySchema = t.Object({
  id: t.Optional(t.String()),
  name: t.Optional(t.String()),
  country: t.Optional(t.String()),
  season: t.Optional(t.String()),
});

export const basketballGamesQuerySchema = t.Object({
  date: t.Optional(t.String()),
  league: t.Optional(t.String()),
  season: t.Optional(t.String()),
  team: t.Optional(t.String()),
  id: t.Optional(t.String()),
  timezone: t.Optional(t.String()),
});

export const basketballTeamsQuerySchema = t.Object({
  id: t.Optional(t.String()),
  name: t.Optional(t.String()),
  league: t.Optional(t.String()),
  season: t.Optional(t.String()),
  search: t.Optional(t.String()),
});

export const basketballStandingsQuerySchema = t.Object({
  league: t.Optional(t.String()),
  season: t.Optional(t.String()),
  team: t.Optional(t.String()),
});

