const TTL_BY_ENDPOINT: Record<string, number> = {
  "/countries": 60 * 60 * 24,
  "/leagues": 60 * 60 * 12,
  "/leagues/seasons": 60 * 60 * 24,
  "/fixtures": 60,
  "/fixtures/rounds": 60 * 60 * 24,
  "/fixtures/headtohead": 60 * 15,
  "/fixtures/statistics": 60,
  "/fixtures/events": 60,
  "/fixtures/lineups": 60,
  "/fixtures/players": 60,
  "/teams/statistics": 60,
  "/timezone": 60 * 60 * 24,
  "/teams": 60 * 30,
  "/teams/seasons": 60 * 60 * 24,
  "/teams/countries": 60 * 60 * 24,
  "/venues": 60 * 60 * 24,
  "/standings": 60 * 15,
  "/injuries": 60 * 5,
  "/predictions": 60 * 10,
  "/coachs": 60 * 30,
  "/players/seasons": 60 * 60 * 24,
  "/players/profiles": 60 * 60,
  "/players": 60 * 30,
  "/players/squads": 60 * 60,
  "/players/teams": 60 * 60 * 12,
  "/players/topscorers": 60 * 30,
  "/players/topassists": 60 * 30,
  "/players/topyellowcards": 60 * 30,
  "/players/topredcards": 60 * 30,
  "/transfers": 60 * 60 * 6,
  "/trophies": 60 * 60 * 24,
  "/sidelined": 60 * 60 * 6,
  "/odds/live": 30,
  "/odds/live/bets": 60 * 60 * 24,
  "/odds": 60,
  "/odds/mapping": 60 * 30,
  "/odds/bookmakers": 60 * 60 * 24,
  "/odds/bets": 60 * 60 * 24,
};

export function getFootballCacheTtlSeconds(endpoint: string, params?: Record<string, unknown>) {
  if (endpoint === "/fixtures") {
    // Match-critical reads must stay hot and near-real-time.
    // `live`, `id` and `ids` are used by live widgets/brackets where stale state is harmful.
    if (params?.live || params?.id || params?.ids) {
      return 5;
    }

    // Date-based fixture lists can tolerate a bit more cache.
    if (params?.date) {
      return 20;
    }
  }

  return TTL_BY_ENDPOINT[endpoint] ?? 0;
}
