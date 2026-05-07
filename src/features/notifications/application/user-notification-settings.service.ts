import { minutoPrismaClient } from "../../../lib/minuto-client";
import { userService } from "../../users/application/user.service";
import { footballService } from "../../sports/application/football.service";
import type { ApiFootballFixtureItem } from "../../sports/domain/football.types";
import type { ToggleFavoriteInput } from "../../favorites/domain/favorites.types";
import { logInfo, logWarn } from "../../../shared/logging/logger";
import {
  captureSubscriptionBaseline,
  deleteSubscriptionBaseline,
  moveSubscriptionBaseline,
  type SubscriptionBaseline,
} from "./subscription-baseline";
import { normalizePhoneNumber } from "../infrastructure/evolution-api.client";
import { templates } from "./templates";
import { buildMatchUrl } from "./match-url";
import { enqueueWhatsappNotificationsBulk } from "../whatsapp/notification.queue";
import {
  canReceiveWhatsappNotifications,
  isLiveTriggerEnabled,
} from "./subscriber-preferences";
import { areNotificationsEnabled } from "../../../shared/config/notifications";

const LIVE_STATUSES = new Set(["1H", "HT", "BT", "INT", "2H", "ET", "P"]);
const TERMINAL_STATUSES = new Set(["FT", "AET", "PEN"]);

function statusLabel(short: string | null): string {
  switch (short) {
    case "1H": return "1ra etapa";
    case "HT": return "Descanso";
    case "2H": return "2da etapa";
    case "ET": return "Tiempo extra";
    case "BT": return "Descanso (prórroga)";
    case "INT": return "Interrumpido";
    case "P": return "Tanda de penales";
    case "FT": return "Final";
    case "AET": return "Final (prórroga)";
    case "PEN": return "Final (penales)";
    default: return short ?? "En curso";
  }
}

const FOOTBALL_TIMEZONE = "UTC";
const TEAM_FAVORITE_LOOKAHEAD = Number(
  process.env.NOTIFICATIONS_TEAM_FAVORITE_LOOKAHEAD ?? 20
);
const LEAGUE_FAVORITE_LOOKAHEAD = Number(
  process.env.NOTIFICATIONS_LEAGUE_FAVORITE_LOOKAHEAD ?? 30
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
  sourceType: "match_favorite" | "team_favorite" | "league_favorite";
  sourceEntityId: number;
};

type SubscriptionFixtureData = {
  fixtureId: number;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeTeam: string;
  awayTeam: string;
  leagueName: string | null;
  /** API-Football league id; necesario para favoritos de liga y prioridad de fuente. */
  leagueId: number | null;
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
  // Normalizamos para que variantes equivalentes (ej. AR con/sin "9" o "0")
  // colapsen al mismo canonico y dispare el unique constraint.
  return normalizePhoneNumber(`${input.dialCode}${input.nationalNumber}`);
}

async function moveSubscriptionsBetweenSubscribers(input: {
  fromSubscriberId: string;
  toSubscriberId: string;
}) {
  const subscriptions = await minutoPrismaClient.matchSubscription.findMany({
    where: { subscriberId: input.fromSubscriberId },
    orderBy: { matchDate: "asc" },
  });

  for (const subscription of subscriptions) {
    const targetAlreadyExists = await minutoPrismaClient.matchSubscription.findUnique({
      where: {
        subscriberId_fixtureId: {
          subscriberId: input.toSubscriberId,
          fixtureId: subscription.fixtureId,
        },
      },
      select: { id: true },
    });

    await minutoPrismaClient.matchSubscription.upsert({
      where: {
        subscriberId_fixtureId: {
          subscriberId: input.toSubscriberId,
          fixtureId: subscription.fixtureId,
        },
      },
      create: {
        subscriberId: input.toSubscriberId,
        fixtureId: subscription.fixtureId,
        homeTeamId: subscription.homeTeamId ?? undefined,
        awayTeamId: subscription.awayTeamId ?? undefined,
        homeTeam: subscription.homeTeam,
        awayTeam: subscription.awayTeam,
        leagueName: subscription.leagueName ?? undefined,
        matchDate: subscription.matchDate,
        sourceType: subscription.sourceType ?? undefined,
        sourceEntityId: subscription.sourceEntityId ?? undefined,
      },
      update: {
        homeTeamId: subscription.homeTeamId ?? undefined,
        awayTeamId: subscription.awayTeamId ?? undefined,
        homeTeam: subscription.homeTeam,
        awayTeam: subscription.awayTeam,
        leagueName: subscription.leagueName ?? undefined,
        matchDate: subscription.matchDate,
        sourceType: subscription.sourceType ?? undefined,
        sourceEntityId: subscription.sourceEntityId ?? undefined,
      },
    });

    if (!targetAlreadyExists) {
      await moveSubscriptionBaseline(
        input.fromSubscriberId,
        input.toSubscriberId,
        subscription.fixtureId
      ).catch(() => {});
    } else {
      await deleteSubscriptionBaseline(input.fromSubscriberId, subscription.fixtureId).catch(() => {});
    }
  }

  await minutoPrismaClient.matchSubscription.deleteMany({
    where: { subscriberId: input.fromSubscriberId },
  });
}

async function resolvePhoneNumberConflict(input: {
  userId: string;
  subscriberId: string;
  phoneNumber: string | null;
}) {
  if (!input.phoneNumber) return null;

  const conflict = await minutoPrismaClient.notificationSubscriber.findFirst({
    where: {
      phoneNumber: input.phoneNumber,
      NOT: { id: input.subscriberId },
    },
    include: {
      subscriptions: true,
    },
  });

  if (!conflict) return null;

  if (conflict.userId && conflict.userId !== input.userId) {
    const error = new Error("Phone number already linked to another account");
    (error as Error & { status?: number }).status = 409;
    throw error;
  }

  if (conflict.id !== input.subscriberId) {
    await moveSubscriptionsBetweenSubscribers({
      fromSubscriberId: conflict.id,
      toSubscriberId: input.subscriberId,
    });

    await minutoPrismaClient.notificationSubscriber.delete({
      where: { id: conflict.id },
    });
  }

  return conflict;
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
    leagueId: typeof fixture.league?.id === "number" ? fixture.league.id : null,
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
  const leagueId = asPositiveInteger(league.id);
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
    leagueId,
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

function sourcePriority(sourceType: string | null | undefined): number {
  if (sourceType === "match_favorite") return 3;
  if (sourceType === "team_favorite") return 2;
  if (sourceType === "league_favorite") return 1;
  return 0;
}

function pickStrongerNotificationSource(
  existing: { sourceType: string | null; sourceEntityId: number | null } | undefined,
  incoming: NotificationSource
): NotificationSource {
  if (!existing?.sourceType || existing.sourceEntityId == null) {
    return incoming;
  }
  const pe = sourcePriority(existing.sourceType);
  const pi = sourcePriority(incoming.sourceType);
  if (pe > pi) {
    return {
      sourceType: existing.sourceType as NotificationSource["sourceType"],
      sourceEntityId: existing.sourceEntityId,
    };
  }
  return incoming;
}

function resolveLeagueSeason(metadata?: Record<string, unknown>): number {
  if (metadata && typeof metadata === "object") {
    const raw = (metadata as Record<string, unknown>).season;
    const s = typeof raw === "number" ? raw : Number(raw);
    if (Number.isInteger(s) && s >= 1990 && s <= 2100) return s;
  }
  return new Date().getFullYear() - 1;
}

async function getCurrentFavoriteSourceForFixture(
  userId: string,
  fixture: Pick<SubscriptionFixtureData, "fixtureId" | "homeTeamId" | "awayTeamId" | "leagueId">
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

  if (teamIds.length) {
    const favoriteTeam = await minutoPrismaClient.favorite.findFirst({
      where: {
        userId,
        sport: "football",
        entityType: "team",
        entityId: { in: teamIds },
      },
      orderBy: { createdAt: "desc" },
    });

    if (favoriteTeam) {
      return {
        sourceType: "team_favorite",
        sourceEntityId: favoriteTeam.entityId,
      };
    }
  }

  if (typeof fixture.leagueId === "number") {
    const favoriteLeague = await minutoPrismaClient.favorite.findUnique({
      where: {
        userId_sport_entityType_entityId: {
          userId,
          sport: "football",
          entityType: "league",
          entityId: fixture.leagueId,
        },
      },
    });

    if (favoriteLeague) {
      return { sourceType: "league_favorite", sourceEntityId: fixture.leagueId };
    }
  }

  return null;
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

  const nextSource = pickStrongerNotificationSource(
    existing
      ? { sourceType: existing.sourceType, sourceEntityId: existing.sourceEntityId }
      : undefined,
    input.source
  );

  const data = {
    homeTeamId: input.fixture.homeTeamId ?? undefined,
    awayTeamId: input.fixture.awayTeamId ?? undefined,
    homeTeam: input.fixture.homeTeam,
    awayTeam: input.fixture.awayTeam,
    leagueName: input.fixture.leagueName ?? undefined,
    matchDate: input.fixture.matchDate,
    sourceType: nextSource.sourceType,
    sourceEntityId: nextSource.sourceEntityId,
  };

  if (existing) {
    const subscription = await minutoPrismaClient.matchSubscription.update({
      where: {
        subscriberId_fixtureId: {
          subscriberId: input.subscriberId,
          fixtureId: input.fixture.fixtureId,
        },
      },
      data,
    });
    return { subscription, baseline: null, wasCreated: false as const };
  }

  const subscription = await minutoPrismaClient.matchSubscription.create({
    data: {
      subscriberId: input.subscriberId,
      fixtureId: input.fixture.fixtureId,
      ...data,
    },
  });

  // CRÍTICO: el baseline DEBE existir antes de devolver. Si lo dejábamos en fire-and-forget,
  // el siguiente poll del live worker podía correr antes de que el baseline se persistiera
  // y, sin baseline, el suscriptor recibía triggers de eventos previos a su suscripción
  // (o, peor, los perdía si el ledger global ya los marcaba como emitidos).
  let capturedBaseline: SubscriptionBaseline | null = null;
  try {
    capturedBaseline = await captureSubscriptionBaseline(
      input.subscriberId,
      input.fixture.fixtureId
    );
  } catch (error: any) {
    logWarn("notifications.subscription_baseline.capture_failed", {
      subscriberId: input.subscriberId,
      fixtureId: input.fixture.fixtureId,
      err: error?.message ?? String(error),
    });
  }

  return { subscription, baseline: capturedBaseline, wasCreated: true as const };
}

/**
 * Cuando un usuario marca como favorito un partido que ya está en curso (o ya terminó),
 * los triggers normales del poller no le van a llegar (los goles/HT/FT pasaron antes
 * de su suscripción). Enviamos un mensaje "estado actual" para confirmar el seguimiento
 * y dejar al usuario al día con el resultado/minuto vigente.
 */
async function dispatchJoinedInProgressNotification(input: {
  subscriber: {
    id: string;
    isActive: boolean;
    phoneNumber: string | null;
    notifyKickoff: boolean;
    notifyGoals: boolean;
    notifyRedCards: boolean;
    notifyVarCancelled: boolean;
    notifyHalftime: boolean;
    notifySecondHalf: boolean;
    notifyFullTime: boolean;
    notifyPreMatch30m: boolean;
  };
  fixture: SubscriptionFixtureData;
  baseline: SubscriptionBaseline | null;
}) {
  if (!areNotificationsEnabled()) return;
  if (!input.baseline) return;
  const status = input.baseline.statusShort;
  const isLive = status != null && LIVE_STATUSES.has(status);
  const isFinished = status != null && TERMINAL_STATUSES.has(status);
  if (!isLive && !isFinished) return;
  if (!canReceiveWhatsappNotifications(input.subscriber)) return;

  // Respetamos la preferencia del usuario: si tiene FULL_TIME/GOAL desactivados,
  // no spamemos un mensaje "te uniste" que el usuario explícitamente no quiere.
  // Heurística: si tiene activado *algún* trigger live, mandamos el aviso.
  const wantsAnyLiveTrigger =
    input.subscriber.notifyKickoff ||
    input.subscriber.notifyGoals ||
    input.subscriber.notifyHalftime ||
    input.subscriber.notifySecondHalf ||
    input.subscriber.notifyFullTime ||
    input.subscriber.notifyRedCards;
  if (!wantsAnyLiveTrigger) return;
  if (isFinished && !isLiveTriggerEnabled(input.subscriber, "FULL_TIME")) return;

  const matchUrl = buildMatchUrl({
    fixtureId: input.fixture.fixtureId,
    leagueName: input.fixture.leagueName ?? "Liga",
    homeTeam: input.fixture.homeTeam,
    awayTeam: input.fixture.awayTeam,
  });

  const message = isFinished
    ? templates.joinedFinished({
        homeTeam: input.fixture.homeTeam,
        awayTeam: input.fixture.awayTeam,
        leagueName: input.fixture.leagueName ?? "Liga",
        matchUrl,
        scoreHome: input.baseline.goalsHome,
        scoreAway: input.baseline.goalsAway,
      })
    : templates.joinedInProgress({
        homeTeam: input.fixture.homeTeam,
        awayTeam: input.fixture.awayTeam,
        leagueName: input.fixture.leagueName ?? "Liga",
        matchUrl,
        scoreHome: input.baseline.goalsHome,
        scoreAway: input.baseline.goalsAway,
        statusLabel: statusLabel(status),
        minute: null,
      });

  // EventKey único por suscripción: si el usuario quita y vuelve a poner el favorito
  // mientras el partido sigue, el TTL de match_msg (30 min) puede o no haber expirado
  // — usamos el timestamp de captura del baseline para diferenciar suscripciones.
  const eventKey = `joined:${input.fixture.fixtureId}:${input.baseline.capturedAtMs}`;

  await enqueueWhatsappNotificationsBulk([
    {
      phone: input.subscriber.phoneNumber!,
      message,
      fixtureId: input.fixture.fixtureId,
      triggerType: isFinished ? "FULL_TIME" : "KICKOFF",
      subscriberId: input.subscriber.id,
      eventKey,
    },
  ]);

  logInfo("notifications.joined_in_progress.enqueued", {
    subscriberId: input.subscriber.id,
    fixtureId: input.fixture.fixtureId,
    status,
    scoreHome: input.baseline.goalsHome,
    scoreAway: input.baseline.goalsAway,
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
    await deleteSubscriptionBaseline(input.subscriberId, input.fixture.fixtureId).catch(() => {});
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
  subscriber: Awaited<ReturnType<typeof getOrCreateSubscriberByUserId>>;
  fixtureId: number;
  metadata?: Record<string, unknown>;
  action: "added" | "removed";
}) {
  const fixture = await resolveFixtureData(input.fixtureId, input.metadata);

  if (input.action === "added") {
    const result = await upsertMatchSubscription({
      subscriberId: input.subscriber.id,
      userId: input.userId,
      fixture,
      source: { sourceType: "match_favorite", sourceEntityId: input.fixtureId },
    });
    if (result.wasCreated) {
      // Solo notificamos "te uniste" para suscripciones nuevas. No queremos disparar el
      // mensaje al re-tocar el corazón (que cae en update) ni cuando una fuente más
      // débil (ej. league_favorite) ya había creado la suscripción.
      await dispatchJoinedInProgressNotification({
        subscriber: input.subscriber,
        fixture,
        baseline: result.baseline,
      });
    }
    return;
  }

  await removeSubscriptionIfUncovered({
    subscriberId: input.subscriber.id,
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
    const fixture = await getFixtureDataFromFootballApi(subscription.fixtureId);

    await removeSubscriptionIfUncovered({
      subscriberId: input.subscriberId,
      userId: input.userId,
      fixture,
    });
  }
}

async function fetchUpcomingLeagueFixtures(leagueId: number, season: number) {
  const envelope = await footballService.getFixtures({
    league: leagueId,
    season,
    next: LEAGUE_FAVORITE_LOOKAHEAD,
    timezone: FOOTBALL_TIMEZONE,
  });

  return (envelope.response ?? []).map(fixtureDataFromApiFixture);
}

async function syncLeagueFavoriteSubscriptions(input: {
  userId: string;
  subscriberId: string;
  leagueId: number;
  metadata?: Record<string, unknown>;
}) {
  const season = resolveLeagueSeason(input.metadata);
  const fixtures = await fetchUpcomingLeagueFixtures(input.leagueId, season);

  for (const fixture of fixtures) {
    await upsertMatchSubscription({
      subscriberId: input.subscriberId,
      userId: input.userId,
      fixture,
      source: { sourceType: "league_favorite", sourceEntityId: input.leagueId },
    });
  }
}

async function removeLeagueFavoriteSubscriptions(input: {
  userId: string;
  subscriberId: string;
  leagueId: number;
}) {
  const subscriptions = await minutoPrismaClient.matchSubscription.findMany({
    where: {
      subscriberId: input.subscriberId,
      sourceType: "league_favorite",
      sourceEntityId: input.leagueId,
    },
  });

  for (const subscription of subscriptions) {
    const fixture = await getFixtureDataFromFootballApi(subscription.fixtureId);

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

    await resolvePhoneNumberConflict({
      userId: user.id,
      subscriberId: subscriber.id,
      phoneNumber,
    });

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
        subscriber,
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
      return;
    }

    if (input.favorite.entityType === "league") {
      if (input.action === "added") {
        await syncLeagueFavoriteSubscriptions({
          userId: input.userId,
          subscriberId: subscriber.id,
          leagueId: input.favorite.entityId,
          metadata: input.favorite.metadata,
        });
        return;
      }

      await removeLeagueFavoriteSubscriptions({
        userId: input.userId,
        subscriberId: subscriber.id,
        leagueId: input.favorite.entityId,
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

  async syncAllFootballLeagueFavoriteSubscriptions() {
    const favorites = await minutoPrismaClient.favorite.findMany({
      where: {
        sport: "football",
        entityType: "league",
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

        const meta =
          favorite.metadata && typeof favorite.metadata === "object" && !Array.isArray(favorite.metadata)
            ? (favorite.metadata as Record<string, unknown>)
            : undefined;

        await syncLeagueFavoriteSubscriptions({
          userId: favorite.userId,
          subscriberId: subscriber.id,
          leagueId: favorite.entityId,
          metadata: meta,
        });
      } catch (error: any) {
        logWarn("notifications.league_favorite_sync.failed", {
          userId: favorite.userId,
          leagueId: favorite.entityId,
          err: error?.message ?? String(error),
        });
      }
    }
  },
};
