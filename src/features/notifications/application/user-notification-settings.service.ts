import { minutoPrismaClient } from "../../../lib/minuto-client";
import { userService } from "../../users/application/user.service";
import { footballService } from "../../sports/application/football.service";
import type { ApiFootballFixtureItem } from "../../sports/domain/football.types";
import type { ToggleFavoriteInput } from "../../favorites/domain/favorites.types";
import { logWarn } from "../../../shared/logging/logger";

const FOOTBALL_TIMEZONE = "UTC";
const TEAM_FAVORITE_LOOKAHEAD = Number(
  process.env.NOTIFICATIONS_TEAM_FAVORITE_LOOKAHEAD ?? 20
);

type NotificationSettingsPatch = {
  name?: string | null;
  countryCode?: string | null;
  dialCode?: string | null;
  nationalNumber?: string | null;
  isActive?: boolean;
  notifyPreMatch30m?: boolean;
  notifyKickoff?: boolean;
  notifyGoals?: boolean;
  notifyRedCards?: boolean;
  notifyVarCancelled?: boolean;
  notifyHalftime?: boolean;
  notifySecondHalf?: boolean;
  notifyFullTime?: boolean;
};

type NotificationSource = {
  sourceType: "match_favorite" | "team_favorite";
  sourceEntityId: number;
};

type SubscriptionFixtureData = {
  fixtureId: number;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeTeam: string;
  awayTeam: string;
  leagueName: string | null;
  matchDate: Date;
};

function trimOrNull(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function digitsOnlyOrNull(value: string | null | undefined, field: string) {
  const trimmed = trimOrNull(value);
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`Invalid ${field}`);
  }
  return trimmed;
}

function buildPhoneNumber(input: { dialCode: string | null; nationalNumber: string | null }) {
  if (!input.dialCode || !input.nationalNumber) return null;
  return `${input.dialCode}${input.nationalNumber}`;
}

function asObject(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, any>;
}

function asPositiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseDateOrNull(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function fixtureDataFromApiFixture(fixture: ApiFootballFixtureItem): SubscriptionFixtureData {
  return {
    fixtureId: fixture.fixture.id,
    homeTeamId: fixture.teams.home.id,
    awayTeamId: fixture.teams.away.id,
    homeTeam: fixture.teams.home.name,
    awayTeam: fixture.teams.away.name,
    leagueName: fixture.league.name ?? null,
    matchDate: new Date(fixture.fixture.date),
  };
}

function tryParseFixtureDataFromFavoriteMetadata(
  fixtureId: number,
  metadata: Record<string, unknown>
): SubscriptionFixtureData | null {
  const root = asObject(metadata);
  const teams = asObject(root.teams);
  const homeTeam = asObject(teams.home ?? root.homeTeam);
  const awayTeam = asObject(teams.away ?? root.awayTeam);
  const league = asObject(root.league);
  const matchDate =
    parseDateOrNull(root.date) ??
    parseDateOrNull(asObject(root.fixture).date) ??
    parseDateOrNull(root.matchDate);

  const homeTeamName = trimOrNull(String(homeTeam.name ?? "")) ?? null;
  const awayTeamName = trimOrNull(String(awayTeam.name ?? "")) ?? null;
  if (!homeTeamName || !awayTeamName || !matchDate) {
    return null;
  }

  return {
    fixtureId,
    homeTeamId: asPositiveInteger(homeTeam.id),
    awayTeamId: asPositiveInteger(awayTeam.id),
    homeTeam: homeTeamName,
    awayTeam: awayTeamName,
    leagueName: trimOrNull(String(league.name ?? "")),
    matchDate,
  };
}

async function getFixtureDataFromFootballApi(fixtureId: number) {
  const envelope = await footballService.getFixtures({
    id: fixtureId,
    timezone: FOOTBALL_TIMEZONE,
  });
  const fixture = envelope.response?.[0];
  if (!fixture) {
    throw new Error(`Fixture not found: ${fixtureId}`);
  }
  return fixtureDataFromApiFixture(fixture);
}

async function resolveFixtureData(
  fixtureId: number,
  metadata?: Record<string, unknown>
): Promise<SubscriptionFixtureData> {
  const fromMetadata = metadata
    ? tryParseFixtureDataFromFavoriteMetadata(fixtureId, metadata)
    : null;
  if (fromMetadata) return fromMetadata;
  return getFixtureDataFromFootballApi(fixtureId);
}

async function getOrCreateSubscriberByUserId(userId: string, defaults?: { name?: string | null }) {
  return minutoPrismaClient.notificationSubscriber.upsert({
    where: { userId },
    create: {
      userId,
      name: defaults?.name ?? undefined,
    },
    update: {
      name: defaults?.name ?? undefined,
    },
  });
}

async function getRequiredUserByClerkId(clerkId: string) {
  return userService.findOrCreateByClerkId(clerkId);
}

async function getCurrentFavoriteSourceForFixture(
  userId: string,
  fixture: Pick<SubscriptionFixtureData, "fixtureId" | "homeTeamId" | "awayTeamId">
): Promise<NotificationSource | null> {
  const favoriteMatch = await minutoPrismaClient.favorite.findUnique({
    where: {
      userId_sport_entityType_entityId: {
        userId,
        sport: "football",
        entityType: "match",
        entityId: fixture.fixtureId,
      },
    },
  });
  if (favoriteMatch) {
    return { sourceType: "match_favorite", sourceEntityId: fixture.fixtureId };
  }

  const teamIds = [fixture.homeTeamId, fixture.awayTeamId].filter(
    (teamId): teamId is number => typeof teamId === "number" && Number.isFinite(teamId)
  );
  if (!teamIds.length) return null;

  const favoriteTeam = await minutoPrismaClient.favorite.findFirst({
    where: {
      userId,
      sport: "football",
      entityType: "team",
      entityId: { in: teamIds },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!favoriteTeam) return null;

  return {
    sourceType: "team_favorite",
    sourceEntityId: favoriteTeam.entityId,
  };
}

async function upsertMatchSubscription(
  input: {
    subscriberId: string;
    userId: string;
    fixture: SubscriptionFixtureData;
    source: NotificationSource;
  }
) {
  const existing = await minutoPrismaClient.matchSubscription.findUnique({
    where: {
      subscriberId_fixtureId: {
        subscriberId: input.subscriberId,
        fixtureId: input.fixture.fixtureId,
      },
    },
  });

  const nextSource =
    existing?.sourceType === "match_favorite" && existing.sourceEntityId
      ? {
          sourceType: "match_favorite",
          sourceEntityId: existing.sourceEntityId,
        }
      : input.source;

  return minutoPrismaClient.matchSubscription.upsert({
    where: {
      subscriberId_fixtureId: {
        subscriberId: input.subscriberId,
        fixtureId: input.fixture.fixtureId,
      },
    },
    create: {
      subscriberId: input.subscriberId,
      fixtureId: input.fixture.fixtureId,
      homeTeamId: input.fixture.homeTeamId ?? undefined,
      awayTeamId: input.fixture.awayTeamId ?? undefined,
      homeTeam: input.fixture.homeTeam,
      awayTeam: input.fixture.awayTeam,
      leagueName: input.fixture.leagueName ?? undefined,
      matchDate: input.fixture.matchDate,
      sourceType: nextSource.sourceType,
      sourceEntityId: nextSource.sourceEntityId,
    },
    update: {
      homeTeamId: input.fixture.homeTeamId ?? undefined,
      awayTeamId: input.fixture.awayTeamId ?? undefined,
      homeTeam: input.fixture.homeTeam,
      awayTeam: input.fixture.awayTeam,
      leagueName: input.fixture.leagueName ?? undefined,
      matchDate: input.fixture.matchDate,
      sourceType: nextSource.sourceType,
      sourceEntityId: nextSource.sourceEntityId,
    },
  });
}

async function removeSubscriptionIfUncovered(input: {
  subscriberId: string;
  userId: string;
  fixture: SubscriptionFixtureData;
}) {
  const source = await getCurrentFavoriteSourceForFixture(input.userId, input.fixture);
  if (!source) {
    await minutoPrismaClient.matchSubscription.deleteMany({
      where: {
        subscriberId: input.subscriberId,
        fixtureId: input.fixture.fixtureId,
      },
    });
    return;
  }

  await minutoPrismaClient.matchSubscription.update({
    where: {
      subscriberId_fixtureId: {
        subscriberId: input.subscriberId,
        fixtureId: input.fixture.fixtureId,
      },
    },
    data: {
      sourceType: source.sourceType,
      sourceEntityId: source.sourceEntityId,
      homeTeamId: input.fixture.homeTeamId ?? undefined,
      awayTeamId: input.fixture.awayTeamId ?? undefined,
      homeTeam: input.fixture.homeTeam,
      awayTeam: input.fixture.awayTeam,
      leagueName: input.fixture.leagueName ?? undefined,
      matchDate: input.fixture.matchDate,
    },
  });
}

async function syncMatchFavoriteNotification(input: {
  userId: string;
  subscriberId: string;
  fixtureId: number;
  metadata?: Record<string, unknown>;
  action: "added" | "removed";
}) {
  const fixture = await resolveFixtureData(input.fixtureId, input.metadata);

  if (input.action === "added") {
    await upsertMatchSubscription({
      subscriberId: input.subscriberId,
      userId: input.userId,
      fixture,
      source: { sourceType: "match_favorite", sourceEntityId: input.fixtureId },
    });
    return;
  }

  await removeSubscriptionIfUncovered({
    subscriberId: input.subscriberId,
    userId: input.userId,
    fixture,
  });
}

async function fetchUpcomingTeamFixtures(teamId: number) {
  const envelope = await footballService.getFixtures({
    team: teamId,
    next: TEAM_FAVORITE_LOOKAHEAD,
    timezone: FOOTBALL_TIMEZONE,
  });

  return (envelope.response ?? []).map(fixtureDataFromApiFixture);
}

async function syncTeamFavoriteSubscriptions(input: {
  userId: string;
  subscriberId: string;
  teamId: number;
}) {
  const fixtures = await fetchUpcomingTeamFixtures(input.teamId);

  for (const fixture of fixtures) {
    await upsertMatchSubscription({
      subscriberId: input.subscriberId,
      userId: input.userId,
      fixture,
      source: { sourceType: "team_favorite", sourceEntityId: input.teamId },
    });
  }
}

async function removeTeamFavoriteSubscriptions(input: {
  userId: string;
  subscriberId: string;
  teamId: number;
}) {
  const subscriptions = await minutoPrismaClient.matchSubscription.findMany({
    where: {
      subscriberId: input.subscriberId,
      OR: [
        { sourceType: "team_favorite", sourceEntityId: input.teamId },
        { homeTeamId: input.teamId },
        { awayTeamId: input.teamId },
      ],
    },
  });

  for (const subscription of subscriptions) {
    const fixture: SubscriptionFixtureData =
      subscription.homeTeamId && subscription.awayTeamId
        ? {
            fixtureId: subscription.fixtureId,
            homeTeamId: subscription.homeTeamId,
            awayTeamId: subscription.awayTeamId,
            homeTeam: subscription.homeTeam,
            awayTeam: subscription.awayTeam,
            leagueName: subscription.leagueName ?? null,
            matchDate: subscription.matchDate,
          }
        : await getFixtureDataFromFootballApi(subscription.fixtureId);

    await removeSubscriptionIfUncovered({
      subscriberId: input.subscriberId,
      userId: input.userId,
      fixture,
    });
  }
}

export const userNotificationSettingsService = {
  async getSettingsByClerkId(clerkId: string) {
    const user = await getRequiredUserByClerkId(clerkId);
    const subscriber = await getOrCreateSubscriberByUserId(user.id, {
      name: user.name,
    });

    return {
      data: subscriber,
      meta: {
        hasPhone: Boolean(subscriber.phoneNumber),
        supportsWhatsAppFavorites: true,
        footballOnly: true,
      },
    };
  },

  async getStatusByClerkId(clerkId: string) {
    const user = await getRequiredUserByClerkId(clerkId);
    const subscriber = await getOrCreateSubscriberByUserId(user.id, {
      name: user.name,
    });

    return {
      data: {
        subscriberId: subscriber.id,
        hasPhone: Boolean(subscriber.phoneNumber),
        isActive: subscriber.isActive,
        phoneNumber: subscriber.phoneNumber,
        countryCode: subscriber.countryCode,
        dialCode: subscriber.dialCode,
        nationalNumber: subscriber.nationalNumber,
        footballOnly: true,
      },
    };
  },

  async updateSettingsByClerkId(clerkId: string, input: NotificationSettingsPatch) {
    const user = await getRequiredUserByClerkId(clerkId);
    const subscriber = await getOrCreateSubscriberByUserId(user.id, {
      name: user.name,
    });

    const dialCode = digitsOnlyOrNull(input.dialCode ?? subscriber.dialCode, "dialCode");
    const nationalNumber = digitsOnlyOrNull(
      input.nationalNumber ?? subscriber.nationalNumber,
      "nationalNumber"
    );
    const countryCode = trimOrNull(input.countryCode ?? subscriber.countryCode)?.toUpperCase() ?? null;
    const phoneNumber = buildPhoneNumber({ dialCode, nationalNumber });

    const data = await minutoPrismaClient.notificationSubscriber.update({
      where: { id: subscriber.id },
      data: {
        name: input.name === undefined ? undefined : trimOrNull(input.name),
        countryCode,
        dialCode,
        nationalNumber,
        phoneNumber,
        isActive: input.isActive,
        notifyPreMatch30m: input.notifyPreMatch30m,
        notifyKickoff: input.notifyKickoff,
        notifyGoals: input.notifyGoals,
        notifyRedCards: input.notifyRedCards,
        notifyVarCancelled: input.notifyVarCancelled,
        notifyHalftime: input.notifyHalftime,
        notifySecondHalf: input.notifySecondHalf,
        notifyFullTime: input.notifyFullTime,
      },
    });

    return {
      data,
      meta: {
        hasPhone: Boolean(data.phoneNumber),
        footballOnly: true,
      },
    };
  },

  async syncFavoriteToggleByUserId(input: {
    userId: string;
    userName?: string | null;
    favorite: ToggleFavoriteInput;
    action: "added" | "removed";
  }) {
    if (input.favorite.sport !== "football") {
      return;
    }

    const subscriber = await getOrCreateSubscriberByUserId(input.userId, {
      name: input.userName ?? null,
    });

    if (input.favorite.entityType === "match") {
      await syncMatchFavoriteNotification({
        userId: input.userId,
        subscriberId: subscriber.id,
        fixtureId: input.favorite.entityId,
        metadata: input.favorite.metadata,
        action: input.action,
      });
      return;
    }

    if (input.favorite.entityType === "team") {
      if (input.action === "added") {
        await syncTeamFavoriteSubscriptions({
          userId: input.userId,
          subscriberId: subscriber.id,
          teamId: input.favorite.entityId,
        });
        return;
      }

      await removeTeamFavoriteSubscriptions({
        userId: input.userId,
        subscriberId: subscriber.id,
        teamId: input.favorite.entityId,
      });
    }
  },

  async syncAllFootballTeamFavoriteSubscriptions() {
    const favorites = await minutoPrismaClient.favorite.findMany({
      where: {
        sport: "football",
        entityType: "team",
      },
      include: {
        user: true,
      },
      orderBy: { createdAt: "desc" },
    });

    for (const favorite of favorites) {
      try {
        const subscriber = await getOrCreateSubscriberByUserId(favorite.userId, {
          name: favorite.user?.name ?? null,
        });

        await syncTeamFavoriteSubscriptions({
          userId: favorite.userId,
          subscriberId: subscriber.id,
          teamId: favorite.entityId,
        });
      } catch (error: any) {
        logWarn("notifications.team_favorite_sync.failed", {
          userId: favorite.userId,
          teamId: favorite.entityId,
          err: error?.message ?? String(error),
        });
      }
    }
  },
};
