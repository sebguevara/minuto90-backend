import { createHash } from "crypto";
import { minutoPrismaClient } from "../lib/minuto-client";
import { templates } from "../features/notifications/application/templates";
import { formatMatchKickoffForSubscriber } from "../features/notifications/application/notification-datetime";
import { buildMatchUrl } from "../features/notifications/application/match-url";
import {
  canReceiveWhatsappNotifications,
  isLiveTriggerEnabled,
} from "../features/notifications/application/subscriber-preferences";
import { enqueueWhatsappNotificationsBulk } from "../features/notifications/whatsapp/notification.queue";
import { redisConnection } from "../shared/redis/redis.connection";
import { areNotificationsEnabled } from "../shared/config/notifications";
import { logError, logInfo, logWarn } from "../shared/logging/logger";
import { userNotificationSettingsService } from "../features/notifications/application/user-notification-settings.service";

const PRE_MATCH_INTERVAL_MS = Number(
  process.env.PRE_MATCH_NOTIFICATIONS_INTERVAL_MS ?? 10 * 60 * 1000
);
const PRE_MATCH_WINDOW_MINUTES = Number(
  process.env.PRE_MATCH_WINDOW_MINUTES ?? 30
);
const PRE_MATCH_DEDUP_TTL_SECONDS = Number(
  process.env.PRE_MATCH_DEDUP_TTL_SECONDS ?? 4 * 60 * 60
);

function preMatchKey(subscriberId: string, fixtureId: number) {
  return `pre_match:${subscriberId}:${fixtureId}`;
}

async function shouldEmitPreMatch(subscriberId: string, fixtureId: number) {
  const res = await redisConnection.set(
    preMatchKey(subscriberId, fixtureId),
    "1",
    "EX",
    PRE_MATCH_DEDUP_TTL_SECONDS,
    "NX"
  );
  return res === "OK";
}

async function pollOnce() {
  if (!areNotificationsEnabled()) return;

  await userNotificationSettingsService.syncAllFootballTeamFavoriteSubscriptions();
  await userNotificationSettingsService.syncAllFootballLeagueFavoriteSubscriptions();

  const now = new Date();
  const until = new Date(now.getTime() + PRE_MATCH_WINDOW_MINUTES * 60 * 1000);

  const subscriptions = await minutoPrismaClient.matchSubscription.findMany({
    where: {
      matchDate: {
        gt: now,
        lte: until,
      },
    },
    include: {
      subscriber: true,
    },
  });

  const jobs: Parameters<typeof enqueueWhatsappNotificationsBulk>[0] = [];

  for (const subscription of subscriptions) {
    const subscriber = subscription.subscriber;
    if (!subscriber?.isActive) continue;
    if (!isLiveTriggerEnabled(subscriber, "PRE_MATCH_30M")) continue;

    const shouldEmit = await shouldEmitPreMatch(
      subscription.subscriberId,
      subscription.fixtureId
    );
    if (!shouldEmit) continue;

    const matchUrl = buildMatchUrl({
      fixtureId: subscription.fixtureId,
      leagueName: subscription.leagueName ?? "Liga",
      homeTeam: subscription.homeTeam,
      awayTeam: subscription.awayTeam,
    });

    const preMatchMessage = templates.preMatch30m({
      homeTeam: subscription.homeTeam,
      awayTeam: subscription.awayTeam,
      leagueName: subscription.leagueName ?? "Liga",
      matchUrl,
      kickoffLabel: formatMatchKickoffForSubscriber(
        subscription.matchDate,
        subscriber
      ),
    });

    const eventKey = createHash("sha1")
      .update(
        `PRE_MATCH_30M:${subscription.subscriberId}:${subscription.fixtureId}:${subscription.matchDate.toISOString()}`
      )
      .digest("hex");

    if (canReceiveWhatsappNotifications(subscriber)) {
      jobs.push({
        phone: subscriber.phoneNumber,
        message: preMatchMessage,
        fixtureId: subscription.fixtureId,
        triggerType: "PRE_MATCH_30M",
        subscriberId: subscription.subscriberId,
        eventKey,
      });
    }
  }

  await enqueueWhatsappNotificationsBulk(jobs);

  if (jobs.length) {
    logInfo("pre_match.notifications.enqueued", {
      jobs: jobs.length,
      windowMinutes: PRE_MATCH_WINDOW_MINUTES,
    });
  }
}

async function main() {
  await redisConnection.ping();
  logInfo("pre_match.worker.started", {
    intervalMs: PRE_MATCH_INTERVAL_MS,
    windowMinutes: PRE_MATCH_WINDOW_MINUTES,
  });

  let running = false;
  const loop = async () => {
    if (running) return;
    running = true;
    try {
      await pollOnce();
    } catch (error: any) {
      logWarn("pre_match.worker.failed", {
        err: error?.message ?? String(error),
      });
    } finally {
      running = false;
    }
  };

  await loop();
  setInterval(loop, PRE_MATCH_INTERVAL_MS);
}

main().catch((error: any) => {
  logError("pre_match.worker.fatal", {
    err: error?.message ?? String(error),
  });
  process.exitCode = 1;
});
