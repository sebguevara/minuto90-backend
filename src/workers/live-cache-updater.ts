import { buildFootballCacheKey } from "../features/sports/infrastructure/football-cache-key";
import { redisFootballCacheStore } from "../features/sports/infrastructure/football-cache.store";
import {
  createFootballLiveSnapshot,
  setFootballLiveSnapshot,
} from "../features/sports/infrastructure/football-live.snapshot";
import { redisConnection } from "../shared/redis/redis.connection";
import { logInfo, logWarn } from "../shared/logging/logger";
import type {
  ApiFootballStandingsEnvelope,
  ApiFootballStandingRow,
  ApiFootballStandingAllSplit,
} from "../features/sports/domain/football.types";

const LIVE_POLL_INTERVAL_MS = Number(process.env.LIVE_POLL_INTERVAL_MS ?? 15000);
const LIVE_CACHE_TTL_SECONDS = Number(
  process.env.LIVE_CACHE_TTL_SECONDS ??
    Math.max(45, Math.ceil(LIVE_POLL_INTERVAL_MS / 1000) * 3)
);

export async function updateLiveFixturesCache(envelope: unknown): Promise<void> {
  const key = buildFootballCacheKey("/fixtures", { live: "all" });
  try {
    await redisFootballCacheStore.set(key, envelope, LIVE_CACHE_TTL_SECONDS);
    await setFootballLiveSnapshot(
      createFootballLiveSnapshot(
        envelope as import("../features/notifications/infrastructure/api-football-live.client").LiveFixturesEnvelope
      )
    );
  } catch (err: any) {
    logWarn("live-cache.update_failed", { key, err: err?.message ?? String(err) });
  }
}

function applySplitResult(
  split: ApiFootballStandingAllSplit,
  goalsFor: number,
  goalsAgainst: number
) {
  split.played = (split.played ?? 0) + 1;
  if (!split.goals) split.goals = { for: 0, against: 0 };
  split.goals.for = (split.goals.for ?? 0) + goalsFor;
  split.goals.against = (split.goals.against ?? 0) + goalsAgainst;
  if (goalsFor > goalsAgainst) {
    split.win = (split.win ?? 0) + 1;
  } else if (goalsFor < goalsAgainst) {
    split.lose = (split.lose ?? 0) + 1;
  } else {
    split.draw = (split.draw ?? 0) + 1;
  }
}

function patchRow(
  row: ApiFootballStandingRow,
  goalsFor: number,
  goalsAgainst: number,
  venue: "home" | "away"
) {
  if (row.all) {
    applySplitResult(row.all, goalsFor, goalsAgainst);
  }
  const venueSplit = row[venue];
  if (venueSplit) {
    applySplitResult(venueSplit, goalsFor, goalsAgainst);
  }
  if (goalsFor > goalsAgainst) {
    row.points = (row.points ?? 0) + 3;
  } else if (goalsFor === goalsAgainst) {
    row.points = (row.points ?? 0) + 1;
  }
  row.goalsDiff = (row.all?.goals?.for ?? 0) - (row.all?.goals?.against ?? 0);
}

function resortGroup(group: ApiFootballStandingRow[]) {
  group.sort((a, b) => {
    const pointsDiff = (b.points ?? 0) - (a.points ?? 0);
    if (pointsDiff !== 0) return pointsDiff;
    const gdDiff = (b.goalsDiff ?? 0) - (a.goalsDiff ?? 0);
    if (gdDiff !== 0) return gdDiff;
    return (b.all?.goals?.for ?? 0) - (a.all?.goals?.for ?? 0);
  });
  group.forEach((row, i) => {
    row.rank = i + 1;
  });
}

/**
 * Optimistically patches the cached standings with the final result of a match.
 * Falls back to plain invalidation if no cached standings exist.
 */
export async function patchStandingsWithResult(input: {
  leagueId: number;
  season: number;
  homeTeamId: number;
  awayTeamId: number;
  homeGoals: number;
  awayGoals: number;
  fixtureId?: number;
}): Promise<void> {
  // Idempotency guard: ensure we only patch once per match, even if called from
  // multiple paths (processOneFixture + handleDisappearances) or across poller restarts.
  const patchGuardKey = input.fixtureId
    ? `standings_patch_done:${input.fixtureId}`
    : `standings_patch_done:${input.leagueId}:${input.season}:${input.homeTeamId}:${input.awayTeamId}`;
  const acquired = await redisConnection.set(patchGuardKey, "1", "EX", 60 * 60 * 6, "NX");
  if (!acquired) {
    logInfo("live-cache.standings_patch_skipped_already_done", { patchGuardKey });
    return;
  }

  const key = buildFootballCacheKey("/standings", {
    league: input.leagueId,
    season: input.season,
  });

  try {
    const cached = await redisFootballCacheStore.get<ApiFootballStandingsEnvelope>(key);

    if (!cached) {
      // Nothing cached — nothing to patch, next request will fetch fresh from API
      logInfo("live-cache.standings_patch_skipped_no_cache", {
        key,
        leagueId: input.leagueId,
        season: input.season,
      });
      return;
    }

    const standingsGroups = cached.response?.[0]?.league?.standings;
    if (!Array.isArray(standingsGroups)) {
      await redisConnection.del(key);
      return;
    }

    let patched = false;
    for (const group of standingsGroups) {
      if (!Array.isArray(group)) continue;
      const homeRow = group.find((r) => r.team?.id === input.homeTeamId);
      const awayRow = group.find((r) => r.team?.id === input.awayTeamId);

      if (homeRow) {
        patchRow(homeRow, input.homeGoals, input.awayGoals, "home");
        patched = true;
      }
      if (awayRow) {
        patchRow(awayRow, input.awayGoals, input.homeGoals, "away");
        patched = true;
      }
      if (homeRow || awayRow) {
        resortGroup(group);
      }
    }

    if (!patched) {
      // Teams not found in this standings — just invalidate
      await redisConnection.del(key);
      logInfo("live-cache.standings_invalidated_teams_not_found", { key });
      return;
    }

    // Preserve remaining TTL so we don't extend the cache beyond its natural expiry
    const remainingTtl = await redisConnection.ttl(key);
    const ttlSeconds = remainingTtl > 0 ? remainingTtl : 60 * 30;

    await redisFootballCacheStore.set(key, cached, ttlSeconds);
    logInfo("live-cache.standings_patched", {
      key,
      leagueId: input.leagueId,
      homeTeamId: input.homeTeamId,
      awayTeamId: input.awayTeamId,
      homeGoals: input.homeGoals,
      awayGoals: input.awayGoals,
      ttlSeconds,
    });
  } catch (err: any) {
    // Best-effort: fall back to plain invalidation
    logWarn("live-cache.standings_patch_failed", {
      key,
      err: err?.message ?? String(err),
    });
    try {
      await redisConnection.del(key);
    } catch {
      // ignore
    }
  }
}

/** @deprecated Use patchStandingsWithResult instead */
export async function invalidateStandingsCache(leagueId: number, season: number): Promise<void> {
  const key = buildFootballCacheKey("/standings", { league: leagueId, season });
  try {
    await redisConnection.del(key);
    logInfo("live-cache.standings_invalidated", { key, leagueId, season });
  } catch (err: any) {
    logWarn("live-cache.standings_invalidate_failed", { key, err: err?.message ?? String(err) });
  }
}
