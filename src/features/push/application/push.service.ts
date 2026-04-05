import { createHash } from "crypto";
import type { Prisma } from "../../../../prisma-minuto/minuto-client-types/client";
import { minutoPrismaClient } from "../../../lib/minuto-client";
import { logInfo } from "../../../shared/logging/logger";
import { redisConnection } from "../../../shared/redis/redis.connection";
import { buildPublicNewsWhere, isNewsPubliclyVisible } from "../../news/application/news.service";
import type { FeaturedMatch } from "../../insights/application/insights.service";
import { userService } from "../../users/application/user.service";
import { getWebPushStatus } from "../infrastructure/web-push.client";
import { enqueueWebPushMatchJobs, enqueueWebPushNewsJobs } from "../push.queue";

const NEWS_PUSH_BATCH_SIZE = Number(process.env.NEWS_PUSH_BATCH_SIZE ?? 25);

function trimToLength(value: string, max: number) {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 3)).trimEnd()}...`;
}

function compactText(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildNewsPushPayload(news: {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  body: string;
  imageUrl: string | null;
}) {
  const fallbackBody =
    compactText(news.summary) ||
    compactText(news.body) ||
    "Nueva publicacion disponible en Minuto 90.";

  return {
    title: trimToLength(compactText(news.title), 80),
    body: trimToLength(fallbackBody, 160),
    url: `/noticias/${news.slug}`,
    imageUrl: news.imageUrl ?? null,
    tag: `news:${news.id}`,
  };
}

async function resolveUserIdByClerkId(clerkId: string | null | undefined) {
  if (!clerkId) return null;
  const user = await userService.findByClerkId(clerkId);
  return user?.id ?? null;
}

const newsPushSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  body: true,
  imageUrl: true,
  featured: true,
  isHidden: true,
  isDeleted: true,
  publishedAt: true,
  publishFrom: true,
  publishTo: true,
  pushSentAt: true,
} satisfies Prisma.NewsSelect;

const MATCH_KICKOFF_PUSH_DEDUP_TTL = 8 * 60 * 60; // 8 hours in seconds
const LIVE_PUSH_MESSAGE_DEDUP_TTL_SECONDS = Number(
  process.env.LIVE_PUSH_MESSAGE_DEDUP_TTL_SECONDS ?? 4 * 60 * 60
);

function matchKickoffDedupKey(fixtureId: number) {
  return `m90:match-kickoff-push:sent:${fixtureId}`;
}

function buildMatchKickoffPushPayload(match: FeaturedMatch) {
  const roundLabel = match.league.round.replace(/Regular Season\s*-?\s*/i, "Jornada ").trim();
  const leagueLabel = trimToLength(match.league.name, 30);

  return {
    title: trimToLength(`⚽ ${match.homeTeam.name} vs ${match.awayTeam.name}`, 80),
    body: trimToLength(`¡Acaba de comenzar! ${leagueLabel} · ${roundLabel}`, 120),
    url: "/",
    imageUrl: match.league.logo || match.homeTeam.logo || null,
    tag: `match-kickoff:${match.fixtureId}`,
  };
}

export const pushService = {
  getStatus() {
    return {
      data: getWebPushStatus(),
    };
  },

  async upsertSubscription(input: {
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string | null;
    clerkId?: string | null;
  }) {
    const status = getWebPushStatus();
    if (!status.enabled) {
      throw new Error("Web push is not configured");
    }

    const userId = await resolveUserIdByClerkId(input.clerkId);
    const now = new Date();
    const createData: Prisma.PushSubscriptionUncheckedCreateInput = {
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? null,
      lastSeenAt: now,
      ...(userId ? { userId } : {}),
    };
    const updateData: Prisma.PushSubscriptionUncheckedUpdateInput = {
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? null,
      lastSeenAt: now,
      ...(userId ? { userId } : {}),
    };

    return minutoPrismaClient.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: createData,
      update: updateData,
    });
  },

  async deleteSubscriptionByEndpoint(endpoint: string) {
    return minutoPrismaClient.pushSubscription.deleteMany({
      where: { endpoint },
    });
  },

  async enqueueNewsPublicationPush(newsId: string) {
    const news = await minutoPrismaClient.news.findUnique({
      where: { id: newsId },
      select: newsPushSelect,
    });

    if (!news) {
      return { status: "missing" as const, jobs: 0 };
    }

    if (news.pushSentAt) {
      return { status: "already-sent" as const, jobs: 0 };
    }

    if (!news.featured) {
      // Mark as sent so the poller doesn't keep re-checking this article
      await minutoPrismaClient.news.update({
        where: { id: news.id },
        data: { pushSentAt: new Date() },
      });
      return { status: "not-featured" as const, jobs: 0 };
    }

    if (!isNewsPubliclyVisible(news)) {
      return { status: "not-public" as const, jobs: 0 };
    }

    const subscriptions = await minutoPrismaClient.pushSubscription.findMany({
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });

    const payload = JSON.stringify(buildNewsPushPayload(news));
    const jobs = subscriptions.map((subscription) => ({
      newsId: news.id,
      subscriptionId: subscription.id,
      payload,
    }));

    await enqueueWebPushNewsJobs(jobs);
    await minutoPrismaClient.news.update({
      where: { id: news.id },
      data: { pushSentAt: new Date() },
    });

    logInfo("push.news.enqueued", {
      newsId: news.id,
      slug: news.slug,
      subscriptions: subscriptions.length,
    });

    return { status: "enqueued" as const, jobs: jobs.length };
  },

  async enqueuePendingPublishedNews(limit = NEWS_PUSH_BATCH_SIZE) {
    const pendingWhere: Prisma.NewsWhereInput = {
      ...buildPublicNewsWhere(new Date()),
      pushSentAt: null,
    };

    const pending = await minutoPrismaClient.news.findMany({
      where: pendingWhere,
      orderBy: [{ publishedAt: "asc" }, { createdAt: "asc" }],
      take: limit,
      select: { id: true },
    });

    let enqueued = 0;

    for (const news of pending) {
      const result = await this.enqueueNewsPublicationPush(news.id);
      if (result.status === "enqueued") {
        enqueued += 1;
      }
    }

    return {
      scanned: pending.length,
      enqueued,
    };
  },

  async enqueueFeaturedMatchKickoffPush(match: FeaturedMatch) {
    const dedupKey = matchKickoffDedupKey(match.fixtureId);
    const alreadySent = await redisConnection.get(dedupKey);

    if (alreadySent) {
      return { status: "already-sent" as const, jobs: 0 };
    }

    const subscriptions = await minutoPrismaClient.pushSubscription.findMany({
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });

    if (!subscriptions.length) {
      return { status: "no-subscribers" as const, jobs: 0 };
    }

    const payload = JSON.stringify(buildMatchKickoffPushPayload(match));
    const jobs = subscriptions.map((subscription) => ({
      fixtureId: match.fixtureId,
      subscriptionId: subscription.id,
      payload,
    }));

    await enqueueWebPushMatchJobs(jobs);
    await redisConnection.setex(dedupKey, MATCH_KICKOFF_PUSH_DEDUP_TTL, "1");

    logInfo("push.match.kickoff.enqueued", {
      fixtureId: match.fixtureId,
      home: match.homeTeam.name,
      away: match.awayTeam.name,
      league: match.league.name,
      subscriptions: subscriptions.length,
    });

    return { status: "enqueued" as const, jobs: jobs.length };
  },

  /**
   * Web push para eventos en vivo / recordatorio, filtrado por usuario (MatchSubscription → subscriber.userId).
   */
  async enqueueLiveMatchWebPush(input: {
    subscriberId: string;
    userId: string | null | undefined;
    fixtureId: number;
    triggerType: string;
    dedupeId: string;
    message: string;
    url: string;
    imageUrl?: string | null;
  }) {
    const status = getWebPushStatus();
    if (!status.enabled) return;
    if (!input.userId) return;

    const dedupeHash = createHash("sha1").update(input.dedupeId).digest("hex");
    const key = `match_push_msg:${input.subscriberId}:${input.fixtureId}:${input.triggerType}:${dedupeHash}`;
    const res = await redisConnection.set(key, "1", "EX", LIVE_PUSH_MESSAGE_DEDUP_TTL_SECONDS, "NX");
    if (res !== "OK") return;

    const plain = input.message
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      .replace(/\*/g, "")
      .replace(/_/g, "")
      .trim();
    const lines = plain
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const title = trimToLength(lines[0] ?? "Minuto 90", 80);
    const body = trimToLength(lines.slice(1).join(" · ") || title, 160);

    const payload = JSON.stringify({
      title,
      body,
      url: input.url,
      imageUrl: input.imageUrl ?? null,
      tag: `live:${input.fixtureId}:${input.triggerType}`,
    });

    const pushSubs = await minutoPrismaClient.pushSubscription.findMany({
      where: { userId: input.userId },
      select: { id: true },
    });
    if (!pushSubs.length) return;

    await enqueueWebPushMatchJobs(
      pushSubs.map((s) => ({
        fixtureId: input.fixtureId,
        subscriptionId: s.id,
        payload,
      }))
    );

    logInfo("push.live.event.enqueued", {
      fixtureId: input.fixtureId,
      triggerType: input.triggerType,
      userId: input.userId,
      devices: pushSubs.length,
    });
  },

  async enqueuePreMatch30mWebPush(input: {
    subscriberId: string;
    userId: string | null | undefined;
    fixtureId: number;
    message: string;
    url: string;
    dedupeId: string;
  }) {
    return this.enqueueLiveMatchWebPush({
      subscriberId: input.subscriberId,
      userId: input.userId,
      fixtureId: input.fixtureId,
      triggerType: "PRE_MATCH_30M",
      dedupeId: input.dedupeId,
      message: input.message,
      url: input.url,
    });
  },
};
