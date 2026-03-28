import { CronJob } from 'cron';
import { footballApiClient } from '../features/sports/infrastructure/football-api.client';
import { nbaApiClient } from '../features/sports/infrastructure/nba-api.client';
import { basketballApiClient } from '../features/sports/infrastructure/basketball-api.client';
import { hockeyApiClient } from '../features/sports/infrastructure/hockey-api.client';
import { rugbyApiClient } from '../features/sports/infrastructure/rugby-api.client';
import { baseballApiClient } from '../features/sports/infrastructure/baseball-api.client';
import { handballApiClient } from '../features/sports/infrastructure/handball-api.client';
import { formula1ApiClient } from '../features/sports/infrastructure/formula1-api.client';
import { mmaApiClient } from '../features/sports/infrastructure/mma-api.client';
import { nflApiClient } from '../features/sports/infrastructure/nfl-api.client';
import { aflApiClient } from '../features/sports/infrastructure/afl-api.client';
import { volleyballApiClient } from '../features/sports/infrastructure/volleyball-api.client';
import { getTeamColors } from '../shared/colors/team-color.service';
import { setFootballTeamsAll, type FootballTeamRef } from '../features/stats/infrastructure/football-teams-all.store';
import { insightsService } from '../features/insights/application/insights.service';
import { logInfo, logError, logWarn } from '../shared/logging/logger';
import { updateLiveFixturesCache } from './live-cache-updater';
import {
  DEFAULT_ODDS_BET,
  DEFAULT_ODDS_BOOKMAKER,
} from '../features/sports/infrastructure/football-odds-cache';
import { warmOddsForDate } from '../features/sports/infrastructure/football-odds-hydration';

const DEFAULT_TIMEZONE = 'UTC';
const CURRENT_SEASON = new Date().getFullYear() - 1; // 2025 for most European leagues in 2026

// Major football league IDs (API-Football) for teams sync
const FOOTBALL_LEAGUES_FOR_TEAMS_SYNC = [
  2,   // UEFA Champions League
  3,   // UEFA Europa League
  39,  // Premier League
  61,  // Ligue 1
  71,  // Brasileirao Serie A
  78,  // Bundesliga
  94,  // Primeira Liga (Portugal)
  103, // Eliteserien (Norway)
  106, // Ekstraklasa (Poland)
  128, // Liga Profesional Argentina
  135, // Serie A
  140, // La Liga
  143, // Copa del Rey
  188, // MLS
  239, // Liga BetPlay Colombia
  253, // Major League Soccer
  262, // Liga MX
  307, // Saudi Pro League
  848, // UEFA Conference League
];

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getDatesRange(pastDays: number, futureDays: number): string[] {
  const today = new Date();
  const dates: string[] = [];
  for (let offset = -pastDays; offset <= futureDays; offset++) {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    dates.push(formatDate(d));
  }
  return dates;
}

async function prewarmTeamColors(
  sport: string,
  teams: Array<{ id: number; logo?: string | null }>
): Promise<void> {
  for (const team of teams) {
    if (!team.id || !team.logo) continue;
    try {
      await getTeamColors(sport, team.id, team.logo);
    } catch (err) {
      logWarn(`prewarm.colors.${sport}.failed`, {
        teamId: team.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

async function warmFrontendSitemaps(): Promise<void> {
  try {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const cronSecret = process.env.CRON_SECRET || 'your-secret-token-here';
    const response = await fetch(`${frontendUrl}/api/sitemap/warm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cronSecret}` },
    });

    if (!response.ok) {
      logWarn('prewarm.sitemap.failed', { status: response.status });
      return;
    }

    const data = await response.json();
    logInfo('prewarm.sitemap.warmed', {
      total: data.total,
      ok: data.ok,
      timestamp: data.timestamp,
    });
  } catch (err) {
    logWarn('prewarm.sitemap.error', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ─── Football ───────────────────────────────────────────────────────────────

async function prewarmFootballFixtures(): Promise<void> {
  logInfo('prewarm.football.fixtures.start', {});
  const dates = getDatesRange(3, 7);
  let total = 0;

  for (const date of dates) {
    try {
      const envelope = await footballApiClient.getFixtures({ date, timezone: DEFAULT_TIMEZONE });
      const fixtures = envelope.response ?? [];
      if (!fixtures.length) continue;
      total += fixtures.length;

      const teamsMap = new Map<number, string>();
      for (const fx of fixtures) {
        if (fx.teams.home.id && fx.teams.home.logo) teamsMap.set(fx.teams.home.id, fx.teams.home.logo);
        if (fx.teams.away.id && fx.teams.away.logo) teamsMap.set(fx.teams.away.id, fx.teams.away.logo);
      }

      await prewarmTeamColors('football', Array.from(teamsMap.entries()).map(([id, logo]) => ({ id, logo })));
    } catch (err) {
      logWarn('prewarm.football.fixtures.date_failed', {
        date,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logInfo('prewarm.football.fixtures.done', { total });
}

async function prewarmFootballOdds(): Promise<void> {
  logInfo('prewarm.football.odds.start', {});
  const dates = getDatesRange(0, 7);
  let total = 0;

  for (const date of dates) {
    try {
      const written = await warmOddsForDate(
        date,
        DEFAULT_TIMEZONE,
        DEFAULT_ODDS_BOOKMAKER,
        DEFAULT_ODDS_BET
      );
      total += written;
    } catch (err) {
      logWarn('prewarm.football.odds.date_failed', {
        date,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logInfo('prewarm.football.odds.done', { total });
}

async function syncFootballTeamsAll(): Promise<void> {
  logInfo('prewarm.football.teams_all.start', {});
  const allTeams = new Map<number, string>(); // minId → logo

  for (const leagueId of FOOTBALL_LEAGUES_FOR_TEAMS_SYNC) {
    try {
      const envelope = await footballApiClient.getTeams({
        league: leagueId,
        season: CURRENT_SEASON,
      });
      const teams = envelope.response ?? [];
      for (const entry of teams) {
        const id = entry.team?.id;
        const logo = entry.team?.logo;
        if (id && logo) allTeams.set(id, logo);
      }
    } catch (err) {
      logWarn('prewarm.football.teams_all.league_failed', {
        leagueId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (allTeams.size > 0) {
    const refs: FootballTeamRef[] = Array.from(allTeams.entries()).map(([id, logo]) => ({ id, logo }));
    await setFootballTeamsAll(refs);
    logInfo('prewarm.football.teams_all.done', { count: refs.length });
  } else {
    logWarn('prewarm.football.teams_all.empty', {});
  }
}

async function prewarmFootballStandings(): Promise<void> {
  logInfo('prewarm.football.standings.start', {});
  const MAIN_LEAGUES = [39, 61, 78, 135, 140, 2, 3];

  for (const league of MAIN_LEAGUES) {
    try {
      await footballApiClient.getStandings({ league, season: CURRENT_SEASON });
    } catch (err) {
      logWarn('prewarm.football.standings.failed', {
        league,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logInfo('prewarm.football.standings.done', {});
}

async function prewarmFootballInsights(): Promise<void> {
  logInfo('prewarm.football.insights.start', {});
  const dates = getDatesRange(1, 1);

  try {
    for (const date of dates) {
      const fixturesEnvelope = await footballApiClient.getFixtures({ date, timezone: DEFAULT_TIMEZONE });
      const fixtures = fixturesEnvelope.response ?? [];
      const ids = fixtures
        .map((fixture) => fixture.fixture?.id)
        .filter((id): id is number => typeof id === 'number' && Number.isFinite(id))
        .slice(0, 80);

      for (const fixtureId of ids) {
        try {
          await insightsService.getMatchStreaks(fixtureId);
        } catch (err) {
          logWarn('prewarm.football.insights.fixture_failed', {
            fixtureId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    const today = formatDate(new Date());
    await insightsService.generateDailyInsights(today);
  } catch (err) {
    logWarn('prewarm.football.insights.failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  logInfo('prewarm.football.insights.done', {});
}

// ─── NBA ─────────────────────────────────────────────────────────────────────

async function prewarmNba(): Promise<void> {
  logInfo('prewarm.nba.start', {});
  const dates = getDatesRange(3, 7);

  for (const date of dates) {
    try {
      const res = await nbaApiClient.getGames({ date, timezone: DEFAULT_TIMEZONE });
      const games = res?.response ?? [];
      if (!games.length) continue;

      const teamsMap = new Map<number, string>();
      for (const g of games) {
        if (g.teams?.home?.id && g.teams.home.logo) teamsMap.set(g.teams.home.id, g.teams.home.logo);
        if (g.teams?.away?.id && g.teams.away.logo) teamsMap.set(g.teams.away.id, g.teams.away.logo);
      }

      await prewarmTeamColors('nba', Array.from(teamsMap.entries()).map(([id, logo]) => ({ id, logo })));
    } catch (err) {
      logWarn('prewarm.nba.date_failed', { date, error: err instanceof Error ? err.message : String(err) });
    }
  }

  logInfo('prewarm.nba.done', {});
}

// ─── Basketball ──────────────────────────────────────────────────────────────

async function prewarmBasketball(): Promise<void> {
  logInfo('prewarm.basketball.start', {});
  const dates = getDatesRange(3, 7);

  for (const date of dates) {
    try {
      const res = await basketballApiClient.getGames({ date, timezone: DEFAULT_TIMEZONE });
      const games = res?.response ?? [];
      if (!games.length) continue;

      const teamsMap = new Map<number, string>();
      for (const g of games) {
        if (g.teams?.home?.id && g.teams.home.logo) teamsMap.set(g.teams.home.id, g.teams.home.logo);
        if (g.teams?.away?.id && g.teams.away.logo) teamsMap.set(g.teams.away.id, g.teams.away.logo);
      }

      await prewarmTeamColors('basketball', Array.from(teamsMap.entries()).map(([id, logo]) => ({ id, logo })));
    } catch (err) {
      logWarn('prewarm.basketball.date_failed', { date, error: err instanceof Error ? err.message : String(err) });
    }
  }

  logInfo('prewarm.basketball.done', {});
}

// ─── Hockey ──────────────────────────────────────────────────────────────────

async function prewarmHockey(): Promise<void> {
  logInfo('prewarm.hockey.start', {});
  const dates = getDatesRange(3, 7);

  for (const date of dates) {
    try {
      const res = await hockeyApiClient.getGames({ date, timezone: DEFAULT_TIMEZONE });
      const games = res?.response ?? [];
      if (!games.length) continue;

      const teamsMap = new Map<number, string>();
      for (const g of games) {
        if (g.teams?.home?.id && g.teams.home.logo) teamsMap.set(g.teams.home.id, g.teams.home.logo);
        if (g.teams?.away?.id && g.teams.away.logo) teamsMap.set(g.teams.away.id, g.teams.away.logo);
      }

      await prewarmTeamColors('hockey', Array.from(teamsMap.entries()).map(([id, logo]) => ({ id, logo })));
    } catch (err) {
      logWarn('prewarm.hockey.date_failed', { date, error: err instanceof Error ? err.message : String(err) });
    }
  }

  logInfo('prewarm.hockey.done', {});
}

// ─── Rugby ───────────────────────────────────────────────────────────────────

async function prewarmRugby(): Promise<void> {
  logInfo('prewarm.rugby.start', {});
  const dates = getDatesRange(2, 7);

  for (const date of dates) {
    try {
      const res = await rugbyApiClient.getGames({ date, timezone: DEFAULT_TIMEZONE });
      const games = res?.response ?? [];
      if (!games.length) continue;

      const teamsMap = new Map<number, string>();
      for (const g of games) {
        if (g.teams?.home?.id && g.teams.home.logo) teamsMap.set(g.teams.home.id, g.teams.home.logo);
        if (g.teams?.away?.id && g.teams.away.logo) teamsMap.set(g.teams.away.id, g.teams.away.logo);
      }

      await prewarmTeamColors('rugby', Array.from(teamsMap.entries()).map(([id, logo]) => ({ id, logo })));
    } catch (err) {
      logWarn('prewarm.rugby.date_failed', { date, error: err instanceof Error ? err.message : String(err) });
    }
  }

  logInfo('prewarm.rugby.done', {});
}

// ─── Baseball ────────────────────────────────────────────────────────────────

async function prewarmBaseball(): Promise<void> {
  logInfo('prewarm.baseball.start', {});
  const dates = getDatesRange(3, 7);

  for (const date of dates) {
    try {
      const res = await baseballApiClient.getGames({ date, timezone: DEFAULT_TIMEZONE });
      const games = res?.response ?? [];
      if (!games.length) continue;

      const teamsMap = new Map<number, string>();
      for (const g of games) {
        if (g.teams?.home?.id && g.teams.home.logo) teamsMap.set(g.teams.home.id, g.teams.home.logo);
        if (g.teams?.away?.id && g.teams.away.logo) teamsMap.set(g.teams.away.id, g.teams.away.logo);
      }

      await prewarmTeamColors('baseball', Array.from(teamsMap.entries()).map(([id, logo]) => ({ id, logo })));
    } catch (err) {
      logWarn('prewarm.baseball.date_failed', { date, error: err instanceof Error ? err.message : String(err) });
    }
  }

  logInfo('prewarm.baseball.done', {});
}

// ─── Handball ────────────────────────────────────────────────────────────────

async function prewarmHandball(): Promise<void> {
  logInfo('prewarm.handball.start', {});
  const dates = getDatesRange(2, 7);

  for (const date of dates) {
    try {
      const res = await handballApiClient.getGames({ date, timezone: DEFAULT_TIMEZONE });
      const games = res?.response ?? [];
      if (!games.length) continue;

      const teamsMap = new Map<number, string>();
      for (const g of games) {
        if (g.teams?.home?.id && g.teams.home.logo) teamsMap.set(g.teams.home.id, g.teams.home.logo);
        if (g.teams?.away?.id && g.teams.away.logo) teamsMap.set(g.teams.away.id, g.teams.away.logo);
      }

      await prewarmTeamColors('handball', Array.from(teamsMap.entries()).map(([id, logo]) => ({ id, logo })));
    } catch (err) {
      logWarn('prewarm.handball.date_failed', { date, error: err instanceof Error ? err.message : String(err) });
    }
  }

  logInfo('prewarm.handball.done', {});
}

// ─── Volleyball ──────────────────────────────────────────────────────────────

async function prewarmVolleyball(): Promise<void> {
  logInfo('prewarm.volleyball.start', {});
  const dates = getDatesRange(3, 7);

  for (const date of dates) {
    try {
      const res = await volleyballApiClient.getGames({ date, timezone: DEFAULT_TIMEZONE });
      const games = res?.response ?? [];
      if (!games.length) continue;

      const teamsMap = new Map<number, string>();
      for (const g of games) {
        if (g.teams?.home?.id && g.teams.home.logo) teamsMap.set(g.teams.home.id, g.teams.home.logo);
        if (g.teams?.away?.id && g.teams.away.logo) teamsMap.set(g.teams.away.id, g.teams.away.logo);
      }

      await prewarmTeamColors('volleyball', Array.from(teamsMap.entries()).map(([id, logo]) => ({ id, logo })));
    } catch (err) {
      logWarn('prewarm.volleyball.date_failed', { date, error: err instanceof Error ? err.message : String(err) });
    }
  }

  logInfo('prewarm.volleyball.done', {});
}

// ─── NFL ─────────────────────────────────────────────────────────────────────

async function prewarmNfl(): Promise<void> {
  logInfo('prewarm.nfl.start', {});
  const dates = getDatesRange(3, 7);

  for (const date of dates) {
    try {
      const res = await nflApiClient.getGames({ date, timezone: DEFAULT_TIMEZONE });
      const games = res?.response ?? [];
      if (!games.length) continue;

      const teamsMap = new Map<number, string>();
      for (const g of games) {
        if (g.teams?.home?.id && g.teams.home.logo) teamsMap.set(g.teams.home.id, g.teams.home.logo);
        if (g.teams?.away?.id && g.teams.away.logo) teamsMap.set(g.teams.away.id, g.teams.away.logo);
      }

      await prewarmTeamColors('nfl', Array.from(teamsMap.entries()).map(([id, logo]) => ({ id, logo })));
    } catch (err) {
      logWarn('prewarm.nfl.date_failed', { date, error: err instanceof Error ? err.message : String(err) });
    }
  }

  logInfo('prewarm.nfl.done', {});
}

// ─── AFL ─────────────────────────────────────────────────────────────────────

async function prewarmAfl(): Promise<void> {
  logInfo('prewarm.afl.start', {});
  const dates = getDatesRange(3, 7);

  for (const date of dates) {
    try {
      const res = await aflApiClient.getGames({ date, timezone: DEFAULT_TIMEZONE });
      const games = res?.response ?? [];
      if (!games.length) continue;

      const teamsMap = new Map<number, string>();
      for (const g of games) {
        if (g.teams?.home?.id && g.teams.home.logo) teamsMap.set(g.teams.home.id, g.teams.home.logo);
        if (g.teams?.away?.id && g.teams.away.logo) teamsMap.set(g.teams.away.id, g.teams.away.logo);
      }

      await prewarmTeamColors('afl', Array.from(teamsMap.entries()).map(([id, logo]) => ({ id, logo })));
    } catch (err) {
      logWarn('prewarm.afl.date_failed', { date, error: err instanceof Error ? err.message : String(err) });
    }
  }

  logInfo('prewarm.afl.done', {});
}

// ─── MMA ─────────────────────────────────────────────────────────────────────

async function prewarmMma(): Promise<void> {
  logInfo('prewarm.mma.start', {});
  try {
    const seasonsRes = await mmaApiClient.getSeasons();
    const seasons = seasonsRes?.response ?? [];
    if (!seasons.length) return;

    const latestSeason = [...seasons].sort((a, b) => Number(b) - Number(a))[0];

    // MMA has no getCategories — fetch fights directly for the latest season
    await mmaApiClient.getFights({ season: Number(latestSeason) });
  } catch (err) {
    logWarn('prewarm.mma.failed', { error: err instanceof Error ? err.message : String(err) });
  }
  logInfo('prewarm.mma.done', {});
}

// ─── Formula 1 ───────────────────────────────────────────────────────────────

async function prewarmF1(): Promise<void> {
  logInfo('prewarm.f1.start', {});
  try {
    // Formula1SeasonsResponse = string[] (raw array, not an envelope)
    const seasons = await formula1ApiClient.getSeasons();
    const seasonList = Array.isArray(seasons) ? seasons : [];
    const sortedSeasons = [...seasonList].sort((a, b) => Number(b) - Number(a));
    const targetSeason = sortedSeasons.length > 0 ? Number(sortedSeasons[0]) : CURRENT_SEASON;

    const [, teamsRes] = await Promise.allSettled([
      formula1ApiClient.getRaces({ season: targetSeason }),
      formula1ApiClient.getTeamRankings({ season: targetSeason }),
      formula1ApiClient.getDriverRankings({ season: targetSeason }),
    ]);

    // Cache F1 team colors
    if (teamsRes.status === 'fulfilled') {
      const rankings = teamsRes.value?.response ?? [];
      for (const entry of rankings) {
        const team = entry.team;
        if (team?.id && team?.logo) {
          try {
            await getTeamColors('f1-team', team.id, team.logo);
          } catch { /* saltar errores individuales */ }
        }
      }
    }
  } catch (err) {
    logWarn('prewarm.f1.failed', { error: err instanceof Error ? err.message : String(err) });
  }
  logInfo('prewarm.f1.done', {});
}

// ─── Main run ────────────────────────────────────────────────────────────────

async function runAllPrewarm(): Promise<void> {
  logInfo('prewarm.daily.start', { timestamp: new Date().toISOString() });

  try {
    // Run sports fixtures prewarm in parallel groups to avoid overwhelming the API
    await Promise.allSettled([
      prewarmFootballFixtures(),
      prewarmNba(),
      prewarmBasketball(),
    ]);

    await Promise.allSettled([
      prewarmHockey(),
      prewarmHandball(),
      prewarmVolleyball(),
    ]);

    await Promise.allSettled([
      prewarmNfl(),
      prewarmAfl(),
      prewarmRugby(),
      prewarmBaseball(),
    ]);

    // Seed live fixtures cache on startup
    try {
      const liveEnvelope = await footballApiClient.getFixtures({ live: 'all' });
      await updateLiveFixturesCache(liveEnvelope);
      logInfo('prewarm.football.live_fixtures.done', {});
    } catch (err) {
      logWarn('prewarm.football.live_fixtures.failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Sync football:teams:all for stats logos (sequential — many league API calls)
    await syncFootballTeamsAll();

    // Pre-cache standings for major leagues
    await prewarmFootballStandings();
    await prewarmFootballOdds();
    await prewarmFootballInsights();

    // MMA + F1 need separate handling
    await Promise.allSettled([prewarmMma(), prewarmF1()]);
  } catch (err) {
    logError('prewarm.daily.fatal', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // ─── Sitemap regeneration ─────────────────────────────────────────────────
  logInfo('prewarm.daily.done', { timestamp: new Date().toISOString() });
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

// Run immediately on startup
runAllPrewarm().catch((err) =>
  logError('prewarm.daily.startup_failed', {
    error: err instanceof Error ? err.message : String(err),
  })
);

warmFrontendSitemaps().catch((err) =>
  logError('prewarm.sitemap.startup_failed', {
    error: err instanceof Error ? err.message : String(err),
  })
);

// Schedule every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
const job = new CronJob(
  '0 */6 * * *',
  () => {
    runAllPrewarm().catch((err) =>
      logError('prewarm.daily.cron_failed', {
        error: err instanceof Error ? err.message : String(err),
      })
    );
  },
  null,
  true,
  'UTC'
);

logInfo('prewarm.daily.scheduled', { schedule: '0 */6 * * *', timezone: 'UTC' });

const sitemapWarmJob = new CronJob(
  '0 */12 * * *',
  () => {
    warmFrontendSitemaps().catch((err) =>
      logError('prewarm.sitemap.cron_failed', {
        error: err instanceof Error ? err.message : String(err),
      })
    );
  },
  null,
  true,
  'UTC'
);

logInfo('prewarm.sitemap.scheduled', { schedule: '0 */12 * * *', timezone: 'UTC' });
