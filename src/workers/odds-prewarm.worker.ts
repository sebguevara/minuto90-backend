import { CronJob } from "cron";

import { logError, logInfo, logWarn } from "../shared/logging/logger";
import { footballService } from "../features/sports/application/football.service";
import { oddsLookupUseCase } from "../features/odds-integration/application/odds-lookup.use-case";
import { tournamentMappingRepository } from "../features/odds-integration/infrastructure/tournament-mapping.repository";

/**
 * Worker de prewarm de cuotas unificadas.
 *
 * Para cada `OddsTournamentMapping` confirmado:
 *   1. Pide los fixtures del rango (hoy + N días futuros) a api-football.
 *   2. Por cada fixture llama a `oddsLookupUseCase.getOdds(fixtureId)`.
 *      Eso resuelve event-mapping (matcher), persiste la fila en DB y deja
 *      el resultado positivo o negativo en Redis con su TTL.
 *
 * Resultado: el primer hit del usuario sobre `/odds/fixture/:id` ya pega cache.
 *
 * Configurable via env:
 *   ODDS_PREWARM_CRON               (default cada 30 min)
 *   ODDS_PREWARM_TIMEZONE           (default UTC)
 *   ODDS_PREWARM_RUN_ON_STARTUP     ("true" para correr al boot)
 *   ODDS_PREWARM_DAYS_AHEAD         (default 1 → hoy + mañana)
 *   ODDS_PREWARM_FIXTURE_CONCURRENCY (default 4)
 */

const DEFAULT_CRON = "*/30 * * * *";
const DEFAULT_TIMEZONE = "UTC";
const DEFAULT_DAYS_AHEAD = 1;
const DEFAULT_CONCURRENCY = 4;
const SOURCE = "kickertech" as const;

const cronExpression = process.env.ODDS_PREWARM_CRON?.trim() || DEFAULT_CRON;
const timezone = process.env.ODDS_PREWARM_TIMEZONE?.trim() || DEFAULT_TIMEZONE;
const runOnStartup = process.env.ODDS_PREWARM_RUN_ON_STARTUP?.trim() === "true";
const daysAhead = clampInt(process.env.ODDS_PREWARM_DAYS_AHEAD, DEFAULT_DAYS_AHEAD, 0, 7);
const concurrency = clampInt(
  process.env.ODDS_PREWARM_FIXTURE_CONCURRENCY,
  DEFAULT_CONCURRENCY,
  1,
  16
);

function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.floor(value), min), max);
}

function utcDateKey(offsetDays: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function dateRange(days: number): string[] {
  const out: string[] = [];
  for (let offset = 0; offset <= days; offset += 1) out.push(utcDateKey(offset));
  return out;
}

interface PrewarmStats {
  fixturesAttempted: number;
  available: number;
  unavailable: number;
  errors: number;
}

async function runWithConcurrency<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  parallel: number
): Promise<void> {
  const queue = items.slice();
  const runners = Array.from({ length: Math.min(parallel, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (item === undefined) return;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

async function prewarmOnce(): Promise<PrewarmStats> {
  const stats: PrewarmStats = { fixturesAttempted: 0, available: 0, unavailable: 0, errors: 0 };

  const mappings = await tournamentMappingRepository.listAllConfirmed(SOURCE);
  if (!mappings.length) {
    logInfo("worker.odds_prewarm.no_mappings");
    return stats;
  }

  const dates = dateRange(daysAhead);
  logInfo("worker.odds_prewarm.start", {
    mappings: mappings.length,
    dates,
    concurrency,
  });

  for (const mapping of mappings) {
    const seasonForFixtures = mapping.apifootballSeason;
    if (seasonForFixtures === null) {
      logWarn("worker.odds_prewarm.skip_wildcard_season", {
        leagueId: mapping.apifootballLeagueId,
        reason: "season_required_for_fixtures_query",
      });
      continue;
    }

    for (const date of dates) {
      let fixtures;
      try {
        const envelope = await footballService.getFixtures({
          league: mapping.apifootballLeagueId,
          season: seasonForFixtures,
          date,
        });
        fixtures = envelope.response;
      } catch (error) {
        stats.errors += 1;
        logWarn("worker.odds_prewarm.fixtures_fetch_failed", {
          leagueId: mapping.apifootballLeagueId,
          season: seasonForFixtures,
          date,
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }

      stats.fixturesAttempted += fixtures.length;

      await runWithConcurrency(
        fixtures,
        async (fixture) => {
          try {
            const result = await oddsLookupUseCase.getOdds(fixture.fixture.id);
            if (result.available) stats.available += 1;
            else stats.unavailable += 1;
          } catch (error) {
            stats.errors += 1;
            logWarn("worker.odds_prewarm.fixture_failed", {
              fixtureId: fixture.fixture.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        },
        concurrency
      );
    }
  }

  logInfo("worker.odds_prewarm.done", { ...stats });
  return stats;
}

if (runOnStartup) {
  prewarmOnce().catch((error) => {
    logError("worker.odds_prewarm.bootstrap_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  });
} else {
  logInfo("worker.odds_prewarm.startup_skipped", { reason: "scheduled_only" });
}

new CronJob(
  cronExpression,
  () => {
    prewarmOnce().catch((error) => {
      logError("worker.odds_prewarm.cron_failed", {
        cronExpression,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  },
  null,
  true,
  timezone
);

logInfo("worker.odds_prewarm.scheduled", { cronExpression, timezone, daysAhead });
