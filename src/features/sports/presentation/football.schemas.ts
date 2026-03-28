import { t } from "elysia";

export const countriesQuerySchema = t.Object({
  name: t.Optional(t.String()),
  code: t.Optional(t.String()),
  search: t.Optional(t.String()),
});

export const timezoneQuerySchema = t.Optional(t.Object({}));

export const leaguesQuerySchema = t.Object({
  id: t.Optional(t.String()),
  name: t.Optional(t.String()),
  code: t.Optional(t.String()),
  search: t.Optional(t.String()),
  country: t.Optional(t.String()),
  season: t.Optional(t.String()),
  current: t.Optional(t.String()),
  team: t.Optional(t.String()),
  type: t.Optional(t.String()),
  last: t.Optional(t.String()),
});

export const fixturesQuerySchema = t.Object({
  id: t.Optional(t.String()),
  ids: t.Optional(t.String()),
  league: t.Optional(t.String()),
  season: t.Optional(t.String()),
  team: t.Optional(t.String()),
  live: t.Optional(t.String()),
  date: t.Optional(t.String()),
  from: t.Optional(t.String()),
  to: t.Optional(t.String()),
  next: t.Optional(t.String()),
  last: t.Optional(t.String()),
  round: t.Optional(t.String()),
  status: t.Optional(t.String()),
  venue: t.Optional(t.String()),
  timezone: t.Optional(t.String()),
});

export const fixtureRoundsQuerySchema = t.Object({
  league: t.String(),
  season: t.String(),
  current: t.Optional(t.String()),
  timezone: t.Optional(t.String()),
  dates: t.Optional(t.String()),
});

export const fixtureHeadToHeadQuerySchema = t.Object({
  h2h: t.String(),
  league: t.Optional(t.String()),
  season: t.Optional(t.String()),
  date: t.Optional(t.String()),
  from: t.Optional(t.String()),
  to: t.Optional(t.String()),
  next: t.Optional(t.String()),
  last: t.Optional(t.String()),
  status: t.Optional(t.String()),
  venue: t.Optional(t.String()),
  timezone: t.Optional(t.String()),
});

export const fixtureStatisticsQuerySchema = t.Object({
  fixture: t.String(),
  team: t.Optional(t.String()),
  type: t.Optional(t.String()),
  half: t.Optional(t.String()),
});

export const fixtureEventsQuerySchema = t.Object({
  fixture: t.String(),
  team: t.Optional(t.String()),
  player: t.Optional(t.String()),
  type: t.Optional(t.String()),
});

export const fixtureLineupsQuerySchema = t.Object({
  fixture: t.String(),
  team: t.Optional(t.String()),
  player: t.Optional(t.String()),
  type: t.Optional(t.String()),
});

export const fixturePlayersQuerySchema = t.Object({
  fixture: t.String(),
  team: t.Optional(t.String()),
});

export const teamsQuerySchema = t.Object({
  id: t.Optional(t.String()),
  name: t.Optional(t.String()),
  league: t.Optional(t.String()),
  season: t.Optional(t.String()),
  country: t.Optional(t.String()),
  code: t.Optional(t.String()),
  venue: t.Optional(t.String()),
  search: t.Optional(t.String()),
});

export const teamStatisticsQuerySchema = t.Object({
  league: t.String(),
  season: t.String(),
  team: t.String(),
  date: t.Optional(t.String()),
});

export const teamSeasonsQuerySchema = t.Object({
  team: t.String(),
});

export const venuesQuerySchema = t.Object({
  id: t.Optional(t.String()),
  name: t.Optional(t.String()),
  city: t.Optional(t.String()),
  country: t.Optional(t.String()),
  search: t.Optional(t.String()),
});

export const standingsQuerySchema = t.Object({
  league: t.Optional(t.String()),
  season: t.String(),
  team: t.Optional(t.String()),
});

export const injuriesQuerySchema = t.Object({
  league: t.Optional(t.String()),
  season: t.Optional(t.String()),
  fixture: t.Optional(t.String()),
  team: t.Optional(t.String()),
  player: t.Optional(t.String()),
  date: t.Optional(t.String()),
  ids: t.Optional(t.String()),
  timezone: t.Optional(t.String()),
});

export const predictionsQuerySchema = t.Object({
  fixture: t.String(),
});

export const coachsQuerySchema = t.Object({
  id: t.Optional(t.String()),
  team: t.Optional(t.String()),
  search: t.Optional(t.String()),
});

export const playerProfilesQuerySchema = t.Object({
  player: t.String(),
});

export const playersQuerySchema = t.Object({
  id: t.Optional(t.String()),
  team: t.Optional(t.String()),
  league: t.Optional(t.String()),
  season: t.Optional(t.String()),
  search: t.Optional(t.String()),
  page: t.Optional(t.String()),
});

export const playerSquadsQuerySchema = t.Object({
  team: t.Optional(t.String()),
  player: t.Optional(t.String()),
});

export const playerTeamsQuerySchema = t.Object({
  player: t.String(),
});

export const topPlayersQuerySchema = t.Object({
  league: t.String(),
  season: t.String(),
});

export const transfersQuerySchema = t.Object({
  player: t.Optional(t.String()),
  team: t.Optional(t.String()),
});

export const trophiesQuerySchema = t.Object({
  player: t.Optional(t.String()),
  players: t.Optional(t.String()),
  coach: t.Optional(t.String()),
  coachs: t.Optional(t.String()),
});

export const sidelinedQuerySchema = t.Object({
  player: t.Optional(t.String()),
  players: t.Optional(t.String()),
  coach: t.Optional(t.String()),
  coachs: t.Optional(t.String()),
});

export const oddsLiveQuerySchema = t.Object({
  fixture: t.Optional(t.String()),
  league: t.Optional(t.String()),
  bet: t.Optional(t.String()),
});

export const oddsLiveBetsQuerySchema = t.Object({
  id: t.Optional(t.String()),
  search: t.Optional(t.String()),
});

export const oddsQuerySchema = t.Object({
  fixture: t.Optional(t.String()),
  fixtures: t.Optional(t.String()),
  league: t.Optional(t.String()),
  season: t.Optional(t.String()),
  date: t.Optional(t.String()),
  timezone: t.Optional(t.String()),
  page: t.Optional(t.String()),
  bookmaker: t.Optional(t.String()),
  bet: t.Optional(t.String()),
  cacheOnly: t.Optional(t.String()),
  /** Lee Redis y solo pide a la API los fixtures sin cuotas guardadas. */
  hydrateMissing: t.Optional(t.String()),
});

export const oddsMappingQuerySchema = t.Object({
  page: t.Optional(t.String()),
});

export const oddsBookmakersQuerySchema = t.Object({
  id: t.Optional(t.String()),
  search: t.Optional(t.String()),
});

export const oddsBetsQuerySchema = t.Object({
  id: t.Optional(t.String()),
  search: t.Optional(t.String()),
});
