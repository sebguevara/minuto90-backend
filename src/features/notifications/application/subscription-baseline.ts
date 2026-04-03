import { minutoPrismaClient } from "../../../lib/minuto-client";
import { redisConnection } from "../../../shared/redis/redis.connection";
import { footballService } from "../../sports/application/football.service";
import { buildStoredState, type StoredMatchState } from "./diff-engine";
import type { ApiFootballLiveFixture } from "../infrastructure/api-football-live.client";

const SUBSCRIPTION_BASELINE_TTL_SECONDS = 60 * 60 * 12;

export type SubscriptionBaseline = {
  fixtureId: number;
  statusShort: string | null;
  goalsHome: number;
  goalsAway: number;
  redCards: number;
  eventKeys: string[];
  capturedAtMs: number;
};

function matchStateKey(fixtureId: number) {
  return `match_state:${fixtureId}`;
}

function subscriptionBaselineKey(subscriberId: string, fixtureId: number) {
  return `match_subscription_baseline:${subscriberId}:${fixtureId}`;
}

function fromStoredState(state: StoredMatchState): SubscriptionBaseline {
  return {
    fixtureId: state.fixtureId,
    statusShort: state.statusShort,
    goalsHome: state.goalsHome,
    goalsAway: state.goalsAway,
    redCards: state.redCards,
    eventKeys: state.eventKeys ?? [],
    capturedAtMs: Date.now(),
  };
}

async function readStoredMatchState(fixtureId: number): Promise<StoredMatchState | null> {
  const raw = await redisConnection.get(matchStateKey(fixtureId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredMatchState;
  } catch {
    return null;
  }
}

function toLiveFixture(input: {
  fixture: Awaited<ReturnType<typeof footballService.getFixtures>>["response"][number];
  events: Awaited<ReturnType<typeof footballService.getFixtureEvents>>["response"];
}): ApiFootballLiveFixture {
  return {
    fixture: {
      id: input.fixture.fixture.id,
      date: input.fixture.fixture.date,
      status: {
        short: input.fixture.fixture.status.short,
        elapsed: input.fixture.fixture.status.elapsed,
      },
    },
    league: {
      id: input.fixture.league.id,
      name: input.fixture.league.name,
    },
    teams: {
      home: { name: input.fixture.teams.home.name },
      away: { name: input.fixture.teams.away.name },
    },
    goals: {
      home: input.fixture.goals.home,
      away: input.fixture.goals.away,
    },
    score: input.fixture.score,
    events: (input.events ?? []).map((event) => ({
      time: {
        elapsed: event.time?.elapsed ?? null,
        extra: event.time?.extra ?? null,
      },
      team: {
        id: event.team?.id ?? null,
        name: event.team?.name ?? null,
      },
      player: {
        id: event.player?.id ?? null,
        name: event.player?.name ?? null,
      },
      assist: {
        id: event.assist?.id ?? null,
        name: event.assist?.name ?? null,
      },
      type: event.type ?? null,
      detail: event.detail ?? null,
      comments: event.comments ?? null,
    })),
  };
}

async function fetchCurrentFixtureBaseline(fixtureId: number): Promise<SubscriptionBaseline | null> {
  const fixtureEnvelope = await footballService.getFixtures({
    id: fixtureId,
    timezone: "UTC",
  });
  const fixture = fixtureEnvelope.response?.[0];
  if (!fixture) return null;

  const eventsEnvelope = await footballService.getFixtureEvents({ fixture: fixtureId }).catch(() => ({
    response: [],
  }));

  const liveFixture = toLiveFixture({
    fixture,
    events: eventsEnvelope.response ?? [],
  });

  return fromStoredState(buildStoredState(liveFixture));
}

export async function resolveSubscriptionBaseline(fixtureId: number): Promise<SubscriptionBaseline | null> {
  const stored = await readStoredMatchState(fixtureId);
  if (stored) return fromStoredState(stored);
  return fetchCurrentFixtureBaseline(fixtureId);
}

export async function getSubscriptionBaseline(
  subscriberId: string,
  fixtureId: number
): Promise<SubscriptionBaseline | null> {
  const raw = await redisConnection.get(subscriptionBaselineKey(subscriberId, fixtureId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SubscriptionBaseline;
  } catch {
    return null;
  }
}

export async function setSubscriptionBaseline(
  subscriberId: string,
  fixtureId: number,
  baseline: SubscriptionBaseline
) {
  await redisConnection.set(
    subscriptionBaselineKey(subscriberId, fixtureId),
    JSON.stringify(baseline),
    "EX",
    SUBSCRIPTION_BASELINE_TTL_SECONDS
  );
}

export async function captureSubscriptionBaseline(subscriberId: string, fixtureId: number) {
  const baseline = await resolveSubscriptionBaseline(fixtureId);
  if (!baseline) return null;
  await setSubscriptionBaseline(subscriberId, fixtureId, baseline);
  return baseline;
}

export async function deleteSubscriptionBaseline(subscriberId: string, fixtureId: number) {
  await redisConnection.del(subscriptionBaselineKey(subscriberId, fixtureId));
}

export async function moveSubscriptionBaseline(
  fromSubscriberId: string,
  toSubscriberId: string,
  fixtureId: number
) {
  const target = await getSubscriptionBaseline(toSubscriberId, fixtureId);
  if (target) {
    await deleteSubscriptionBaseline(fromSubscriberId, fixtureId);
    return;
  }

  const source = await getSubscriptionBaseline(fromSubscriberId, fixtureId);
  if (!source) return;

  await setSubscriptionBaseline(toSubscriberId, fixtureId, source);
  await deleteSubscriptionBaseline(fromSubscriberId, fixtureId);
}

export async function backfillSubscriptionBaselinesForFixture(fixtureId: number) {
  const baseline = await resolveSubscriptionBaseline(fixtureId);
  if (!baseline) return;

  const subscriptions = await minutoPrismaClient.matchSubscription.findMany({
    where: { fixtureId },
    select: { subscriberId: true },
  });

  for (const subscription of subscriptions) {
    await setSubscriptionBaseline(subscription.subscriberId, fixtureId, baseline);
  }
}
