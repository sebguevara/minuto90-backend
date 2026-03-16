import { t } from "elysia";

export const hockeyLeaguesQuerySchema = t.Object({
  id: t.Optional(t.String()),
  name: t.Optional(t.String()),
  country: t.Optional(t.String()),
  season: t.Optional(t.String()),
});

export const hockeyGamesQuerySchema = t.Object({
  date: t.Optional(t.String()),
  league: t.Optional(t.String()),
  season: t.Optional(t.String()),
  team: t.Optional(t.String()),
  id: t.Optional(t.String()),
  timezone: t.Optional(t.String()),
});

export const hockeyTeamsQuerySchema = t.Object({
  id: t.Optional(t.String()),
  name: t.Optional(t.String()),
  league: t.Optional(t.String()),
  season: t.Optional(t.String()),
});

export const hockeyStandingsQuerySchema = t.Object({
  league: t.Optional(t.String()),
  season: t.Optional(t.String()),
  team: t.Optional(t.String()),
});

