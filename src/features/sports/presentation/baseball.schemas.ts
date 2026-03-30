import { t } from "elysia";

export const baseballLeaguesQuerySchema = t.Object({
  id: t.Optional(t.String()),
  name: t.Optional(t.String()),
  country: t.Optional(t.String()),
  season: t.Optional(t.String()),
});

export const baseballGamesQuerySchema = t.Object({
  date: t.Optional(t.String()),
  league: t.Optional(t.String()),
  season: t.Optional(t.String()),
  team: t.Optional(t.String()),
  id: t.Optional(t.String()),
  timezone: t.Optional(t.String()),
});

export const baseballTeamsQuerySchema = t.Object({
  id: t.Optional(t.String()),
  name: t.Optional(t.String()),
  league: t.Optional(t.String()),
  season: t.Optional(t.String()),
  country_id: t.Optional(t.String()),
});

export const baseballStandingsQuerySchema = t.Object({
  league: t.Optional(t.String()),
  season: t.Optional(t.String()),
  team: t.Optional(t.String()),
});
