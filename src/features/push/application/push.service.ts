import type { Prisma } from "../../../../prisma-minuto/minuto-client-types/client";
import { minutoPrismaClient } from "../../../lib/minuto-client";
import { logInfo } from "../../../shared/logging/logger";
import { redisConnection } from "../../../shared/redis/redis.connection";
import { areNotificationsEnabled } from "../../../shared/config/notifications";
import { buildPublicNewsWhere, isNewsPubliclyVisible } from "../../news/application/news.service";
import { userService } from "../../users/application/user.service";
import { getWebPushStatus } from "../infrastructure/web-push.client";
import { enqueueWebPushNewsJobs, enqueueWebPushCustomJobs } from "../push.queue";

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
    if (!areNotificationsEnabled()) {
      throw new Error("Notifications are disabled");
    }

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
    if (!areNotificationsEnabled()) {
      return { status: "disabled" as const, jobs: 0 };
    }

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
    if (!areNotificationsEnabled()) {
      return {
        scanned: 0,
        enqueued: 0,
      };
    }

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

  async sendCustomPushNotification(input: {
    title: string;
    body: string;
    imageUrl?: string | null;
    url?: string | null;
  }) {
    if (!areNotificationsEnabled()) {
      throw new Error("Notifications are disabled");
    }

    const status = getWebPushStatus();
    if (!status.enabled) {
      throw new Error("Web push is not configured");
    }

    const subscriptions = await minutoPrismaClient.pushSubscription.findMany({
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });

    if (!subscriptions.length) {
      return { status: "no-subscriptions" as const, jobs: 0 };
    }

    const payloadObj = {
      title: trimToLength(compactText(input.title), 80),
      body: trimToLength(compactText(input.body), 160),
      url: input.url ?? "/",
      imageUrl: input.imageUrl ?? null,
      tag: `custom:${Date.now()}`,
    };

    const payloadStr = JSON.stringify(payloadObj);
    const customId = `cm-${Date.now()}`;

    const jobs = subscriptions.map((sub) => ({
      customId,
      subscriptionId: sub.id,
      payload: payloadStr,
    }));

    await enqueueWebPushCustomJobs(jobs);

    logInfo("push.custom.enqueued", {
      customId,
      jobs: jobs.length,
    });

    return { status: "enqueued" as const, jobs: jobs.length };
  },
};
