import type { StoredMatchState } from "../../notifications/application/diff-engine";
import { getFootballLiveSnapshot } from "./football-live.snapshot";
import { redisConnection } from "../../../shared/redis/redis.connection";

const LIVE_STATUS_SHORTS = new Set([
  "1H",
  "HT",
  "2H",
  "ET",
  "BT",
  "P",
  "LIVE",
  "INT",
]);

export interface FootballLiveClockAnchor {
  elapsed: number;
  anchoredAtMs: number;
  serverNowMs: number;
  source: "match_state" | "snapshot";
}

function matchStateKey(fixtureId: number) {
  return `match_state:${fixtureId}`;
}

function isLiveStatus(statusShort: string | null | undefined) {
  return typeof statusShort === "string" && LIVE_STATUS_SHORTS.has(statusShort);
}

function parseStoredState(raw: string | null): StoredMatchState | null {
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredMatchState;
  } catch {
    return null;
  }
}

function buildAnchorFromStoredState(
  state: StoredMatchState | null,
  serverNowMs: number
): FootballLiveClockAnchor | null {
  if (!state || !isLiveStatus(state.statusShort)) {
    return null;
  }

  const elapsed = state.fixture?.fixture?.status?.elapsed;
  if (typeof elapsed !== "number" || !Number.isFinite(elapsed) || elapsed < 0) {
    return null;
  }

  if (!Number.isFinite(state.updatedAtMs) || state.updatedAtMs <= 0) {
    return null;
  }

  return {
    elapsed,
    anchoredAtMs: state.updatedAtMs,
    serverNowMs,
    source: "match_state",
  };
}

export async function getFootballLiveClockAnchors(
  fixtureIds: number[],
  serverNowMs = Date.now()
): Promise<Map<number, FootballLiveClockAnchor>> {
  const uniqueIds = Array.from(
    new Set(
      fixtureIds.filter(
        (fixtureId): fixtureId is number =>
          typeof fixtureId === "number" && Number.isFinite(fixtureId) && fixtureId > 0
      )
    )
  );

  if (!uniqueIds.length) {
    return new Map();
  }

  const anchors = new Map<number, FootballLiveClockAnchor>();

  try {
    const rawStates = await redisConnection.mget(...uniqueIds.map(matchStateKey));

    uniqueIds.forEach((fixtureId, index) => {
      const anchor = buildAnchorFromStoredState(
        parseStoredState(rawStates[index] ?? null),
        serverNowMs
      );

      if (anchor) {
        anchors.set(fixtureId, anchor);
      }
    });
  } catch {
    // Redis read failures fall back to snapshot lookup below.
  }

  if (anchors.size === uniqueIds.length) {
    return anchors;
  }

  const snapshot = await getFootballLiveSnapshot();
  if (!snapshot?.response?.length) {
    return anchors;
  }

  const snapshotAnchoredAtMs = Date.parse(snapshot.updatedAt);
  if (!Number.isFinite(snapshotAnchoredAtMs) || snapshotAnchoredAtMs <= 0) {
    return anchors;
  }

  for (const fixture of snapshot.response) {
    const fixtureId = fixture?.fixture?.id;
    if (typeof fixtureId !== "number" || anchors.has(fixtureId)) {
      continue;
    }

    const statusShort = fixture.fixture?.status?.short;
    const elapsed = fixture.fixture?.status?.elapsed;

    if (!isLiveStatus(statusShort)) {
      continue;
    }

    if (typeof elapsed !== "number" || !Number.isFinite(elapsed) || elapsed < 0) {
      continue;
    }

    anchors.set(fixtureId, {
      elapsed,
      anchoredAtMs: snapshotAnchoredAtMs,
      serverNowMs,
      source: "snapshot",
    });
  }

  return anchors;
}
