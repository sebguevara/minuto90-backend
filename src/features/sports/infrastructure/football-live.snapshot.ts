import type {
  ApiFootballLiveFixture,
  LiveFixturesEnvelope,
} from "../../notifications/infrastructure/api-football-live.client";
import { logWarn } from "../../../shared/logging/logger";
import { redisConnection } from "../../../shared/redis/redis.connection";

const LIVE_POLL_INTERVAL_MS = Number(process.env.LIVE_POLL_INTERVAL_MS ?? 20000);
const LIVE_SNAPSHOT_TTL_SECONDS = Number(
  process.env.LIVE_SNAPSHOT_TTL_SECONDS ??
    Math.max(45, Math.ceil(LIVE_POLL_INTERVAL_MS / 1000) * 3)
);

export const FOOTBALL_LIVE_SNAPSHOT_KEY = "football:live:snapshot";

export interface FootballLiveSnapshot {
  version: string;
  updatedAt: string;
  results: number;
  response: ApiFootballLiveFixture[];
  source: "redis";
}

export function createFootballLiveSnapshot(
  envelope: LiveFixturesEnvelope
): FootballLiveSnapshot {
  const response = Array.isArray(envelope?.response) ? envelope.response : [];

  return {
    version: `${Date.now()}`,
    updatedAt: new Date().toISOString(),
    results: response.length,
    response,
    source: "redis",
  };
}

export function createEmptyFootballLiveSnapshot(): FootballLiveSnapshot {
  return {
    version: "empty",
    updatedAt: new Date().toISOString(),
    results: 0,
    response: [],
    source: "redis",
  };
}

export async function setFootballLiveSnapshot(
  snapshot: FootballLiveSnapshot
): Promise<void> {
  try {
    await redisConnection.set(
      FOOTBALL_LIVE_SNAPSHOT_KEY,
      JSON.stringify(snapshot),
      "EX",
      LIVE_SNAPSHOT_TTL_SECONDS
    );
  } catch (error) {
    logWarn("football.live_snapshot.set_failed", {
      key: FOOTBALL_LIVE_SNAPSHOT_KEY,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function getFootballLiveSnapshot(): Promise<FootballLiveSnapshot | null> {
  try {
    const raw = await redisConnection.get(FOOTBALL_LIVE_SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FootballLiveSnapshot;
  } catch (error) {
    logWarn("football.live_snapshot.get_failed", {
      key: FOOTBALL_LIVE_SNAPSHOT_KEY,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
