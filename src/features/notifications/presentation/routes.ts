import { Elysia, t } from "elysia";
import { minutoPrismaClient } from "../../../lib/minuto-client";
import {
  evolutionApiClient,
  getActiveEvolutionInstances,
  normalizePhoneNumber,
} from "../infrastructure/evolution-api.client";
import { selectEvolutionInstance } from "../infrastructure/evolution-instance.selector";
import { enqueueWhatsappNotification } from "../whatsapp/notification.queue";
import { createHash } from "crypto";
import { logError } from "../../../shared/logging/logger";

function prismaErrorToHttp(err: any): { status: number; message: string } {
  const code = err?.code;
  if (code === "P2002") return { status: 409, message: "Unique constraint violation" };
  if (code === "P2003") return { status: 400, message: "Foreign key constraint violation" };
  if (code === "P2025") return { status: 404, message: "Not found" };
  return { status: 500, message: "Internal server error" };
}

function errorDetails(err: any) {
  if (process.env.NODE_ENV === "production" && process.env.NOTIFICATIONS_DEBUG !== "true") return undefined;
  const code = err?.code;
  const message = err?.message ?? String(err);
  const meta = err?.meta;
  return { code, message, meta };
}

function assertDebugAllowed(request: Request): { ok: true } | { ok: false; status: number; error: string } {
  const token = process.env.DEBUG_API_TOKEN?.trim();
  if (!token) {
    if ((process.env.NODE_ENV ?? "").toLowerCase() === "production") {
      return { ok: false, status: 403, error: "Debug endpoints disabled in production (set DEBUG_API_TOKEN to enable)" };
    }
    return { ok: true };
  }

  const headerToken =
    request.headers.get("x-debug-token") ??
    request.headers.get("x-debug-api-token") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  if (headerToken !== token) return { ok: false, status: 401, error: "Unauthorized" };
  return { ok: true };
}

export const notificationsRoutes = new Elysia({ prefix: "/notifications" })
  // Subscribers
  .get(
    "/subscribers",
    async ({ query, set }) => {
      try {
        const isActive =
          typeof query.isActive === "string"
            ? query.isActive === "true"
            : undefined;
        const where: any = {};
        if (typeof isActive === "boolean") where.isActive = isActive;
        if (query.userId) where.userId = query.userId;
        const data = await minutoPrismaClient.notificationSubscriber.findMany({
          where: Object.keys(where).length ? where : undefined,
          orderBy: { createdAt: "desc" },
          include: { subscriptions: true },
        });
        return { data };
      } catch (err: any) {
        const mapped = prismaErrorToHttp(err);
        set.status = mapped.status;
        return { error: mapped.message };
      }
    },
    {
      detail: { tags: ["Notifications"], summary: "List subscribers" },
      query: t.Object({
        isActive: t.Optional(t.String()),
        userId: t.Optional(t.String()),
      }),
    }
  )
  .post(
    "/subscribers",
    async ({ body, set }) => {
      try {
        const phone = normalizePhoneNumber(body.phoneNumber);
        const data = await minutoPrismaClient.notificationSubscriber.create({
          data: {
            phoneNumber: phone,
            name: body.name,
            isActive: body.isActive ?? true,
            userId: body.userId,
          },
        });
        set.status = 201;
        return { data };
      } catch (err: any) {
        const mapped = prismaErrorToHttp(err);
        set.status = mapped.status;
        return { error: mapped.message };
      }
    },
    {
      detail: { tags: ["Notifications"], summary: "Create subscriber" },
      body: t.Object({
        phoneNumber: t.String(),
        name: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
        userId: t.Optional(t.String()),
      }),
    }
  )
  .get(
    "/subscribers/:id",
    async ({ params, set }) => {
      try {
        const data = await minutoPrismaClient.notificationSubscriber.findUnique({
          where: { id: params.id },
          include: { subscriptions: true },
        });
        if (!data) {
          set.status = 404;
          return { error: "Not found" };
        }
        return { data };
      } catch (err: any) {
        const mapped = prismaErrorToHttp(err);
        set.status = mapped.status;
        return { error: mapped.message };
      }
    },
    {
      detail: { tags: ["Notifications"], summary: "Get subscriber" },
      params: t.Object({ id: t.String() }),
    }
  )
  .patch(
    "/subscribers/:id",
    async ({ params, body, set }) => {
      try {
        const data = await minutoPrismaClient.notificationSubscriber.update({
          where: { id: params.id },
          data: {
            phoneNumber: body.phoneNumber ? normalizePhoneNumber(body.phoneNumber) : undefined,
            name: body.name,
            isActive: body.isActive,
          },
        });
        return { data };
      } catch (err: any) {
        const mapped = prismaErrorToHttp(err);
        set.status = mapped.status;
        return { error: mapped.message };
      }
    },
    {
      detail: { tags: ["Notifications"], summary: "Update subscriber" },
      params: t.Object({ id: t.String() }),
      body: t.Object({
        phoneNumber: t.Optional(t.String()),
        name: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
      }),
    }
  )
  .delete(
    "/subscribers/:id",
    async ({ params, set }) => {
      try {
        const data = await minutoPrismaClient.notificationSubscriber.update({
          where: { id: params.id },
          data: { isActive: false },
        });
        return { data };
      } catch (err: any) {
        const mapped = prismaErrorToHttp(err);
        set.status = mapped.status;
        return { error: mapped.message };
      }
    },
    {
      detail: { tags: ["Notifications"], summary: "Deactivate subscriber" },
      params: t.Object({ id: t.String() }),
    }
  )

  // Subscriptions
  .get(
    "/subscriptions",
    async ({ query, set }) => {
      try {
        const fixtureId = query.fixtureId ? Number(query.fixtureId) : undefined;
        const subscriberId = query.subscriberId;

        const where: any = {};
        if (typeof fixtureId === "number" && Number.isFinite(fixtureId)) where.fixtureId = fixtureId;
        if (subscriberId) where.subscriberId = subscriberId;

        const data = await minutoPrismaClient.matchSubscription.findMany({
          where: Object.keys(where).length ? where : undefined,
          orderBy: { matchDate: "asc" },
          include: { subscriber: true },
        });
        return { data };
      } catch (err: any) {
        const mapped = prismaErrorToHttp(err);
        set.status = mapped.status;
        return { error: mapped.message };
      }
    },
    {
      detail: { tags: ["Notifications"], summary: "List subscriptions" },
      query: t.Object({
        fixtureId: t.Optional(t.String()),
        subscriberId: t.Optional(t.String()),
      }),
    }
  )
  .post(
    "/subscriptions",
    async ({ body, set }) => {
      try {
        const matchDate = new Date(body.matchDate);
        if (Number.isNaN(matchDate.getTime())) {
          set.status = 400;
          return { error: "Invalid matchDate (expected ISO string or YYYY-MM-DD)" };
        }

        const subscriber = await minutoPrismaClient.notificationSubscriber.findUnique({
          where: { id: body.subscriberId },
          select: { id: true },
        });
        if (!subscriber) {
          set.status = 404;
          return { error: "Subscriber not found" };
        }

        const data = await minutoPrismaClient.matchSubscription.create({
          data: {
            subscriberId: body.subscriberId,
            fixtureId: body.fixtureId,
            homeTeam: body.homeTeam,
            awayTeam: body.awayTeam,
            leagueName: body.leagueName,
            matchDate,
          },
        });
        set.status = 201;
        return { data };
      } catch (err: any) {
        logError("notifications.subscription.create_failed", errorDetails(err) ?? { err: err?.message ?? String(err) });
        const mapped = prismaErrorToHttp(err);
        set.status = mapped.status;
        return { error: mapped.message, details: errorDetails(err) };
      }
    },
    {
      detail: { tags: ["Notifications"], summary: "Create subscription" },
      body: t.Object({
        subscriberId: t.String(),
        fixtureId: t.Number(),
        homeTeam: t.String(),
        awayTeam: t.String(),
        leagueName: t.Optional(t.String()),
        matchDate: t.String(),
      }),
    }
  )
  .post(
    "/subscriptions/unsubscribe",
    async ({ body, set }) => {
      try {
        const result = await minutoPrismaClient.matchSubscription.deleteMany({
          where: { subscriberId: body.subscriberId, fixtureId: body.fixtureId },
        });
        return { data: result };
      } catch (err: any) {
        const mapped = prismaErrorToHttp(err);
        set.status = mapped.status;
        return { error: mapped.message };
      }
    },
    {
      detail: { tags: ["Notifications"], summary: "Unsubscribe subscriber from fixture" },
      body: t.Object({
        subscriberId: t.String(),
        fixtureId: t.Number(),
      }),
    }
  )
  .delete(
    "/subscriptions/:id",
    async ({ params, set }) => {
      try {
        const data = await minutoPrismaClient.matchSubscription.delete({
          where: { id: params.id },
        });
        return { data };
      } catch (err: any) {
        const mapped = prismaErrorToHttp(err);
        set.status = mapped.status;
        return { error: mapped.message };
      }
    },
    {
      detail: { tags: ["Notifications"], summary: "Delete subscription" },
      params: t.Object({ id: t.String() }),
    }
  )

  // Evolution instances
  .get(
    "/evolution-instances",
    async ({ set }) => {
      try {
        const data = await minutoPrismaClient.evolutionInstance.findMany({
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            instanceName: true,
            baseUrl: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        return { data };
      } catch (err: any) {
        const mapped = prismaErrorToHttp(err);
        set.status = mapped.status;
        return { error: mapped.message };
      }
    },
    {
      detail: { tags: ["Notifications"], summary: "List Evolution instances" },
    }
  )
  .get(
    "/evolution-instances/active",
    async ({ set }) => {
      try {
        const data = await minutoPrismaClient.evolutionInstance.findMany({
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            instanceName: true,
            baseUrl: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        return { data };
      } catch (err: any) {
        const mapped = prismaErrorToHttp(err);
        set.status = mapped.status;
        return { error: mapped.message };
      }
    },
    {
      detail: { tags: ["Notifications"], summary: "List active Evolution instances" },
    }
  )
  .post(
    "/evolution-instances",
    async ({ body, set }) => {
      try {
        const data = await minutoPrismaClient.evolutionInstance.create({
          data: {
            instanceName: body.instanceName,
            baseUrl: body.baseUrl,
            apiKey: body.apiKey,
            isActive: body.isActive ?? true,
          },
          select: {
            id: true,
            instanceName: true,
            baseUrl: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        set.status = 201;
        return { data };
      } catch (err: any) {
        const mapped = prismaErrorToHttp(err);
        set.status = mapped.status;
        return { error: mapped.message };
      }
    },
    {
      detail: { tags: ["Notifications"], summary: "Create Evolution instance" },
      body: t.Object({
        instanceName: t.String(),
        baseUrl: t.String(),
        apiKey: t.String(),
        isActive: t.Optional(t.Boolean()),
      }),
    }
  )
  .patch(
    "/evolution-instances/:id",
    async ({ params, body, set }) => {
      try {
        const data = await minutoPrismaClient.evolutionInstance.update({
          where: { id: params.id },
          data: {
            instanceName: body.instanceName,
            baseUrl: body.baseUrl,
            apiKey: body.apiKey,
            isActive: body.isActive,
          },
          select: {
            id: true,
            instanceName: true,
            baseUrl: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        return { data };
      } catch (err: any) {
        const mapped = prismaErrorToHttp(err);
        set.status = mapped.status;
        return { error: mapped.message };
      }
    },
    {
      detail: { tags: ["Notifications"], summary: "Update Evolution instance" },
      params: t.Object({ id: t.String() }),
      body: t.Object({
        instanceName: t.Optional(t.String()),
        baseUrl: t.Optional(t.String()),
        apiKey: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
      }),
    }
  )
  .post(
    "/evolution-instances/:id/activate",
    async ({ params, set }) => {
      try {
        const data = await minutoPrismaClient.evolutionInstance.update({
          where: { id: params.id },
          data: { isActive: true },
          select: {
            id: true,
            instanceName: true,
            baseUrl: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        return { data };
      } catch (err: any) {
        const mapped = prismaErrorToHttp(err);
        set.status = mapped.status;
        return { error: mapped.message };
      }
    },
    {
      detail: { tags: ["Notifications"], summary: "Activate Evolution instance" },
      params: t.Object({ id: t.String() }),
    }
  )
  .post(
    "/evolution-instances/:id/deactivate",
    async ({ params, set }) => {
      try {
        const data = await minutoPrismaClient.evolutionInstance.update({
          where: { id: params.id },
          data: { isActive: false },
          select: {
            id: true,
            instanceName: true,
            baseUrl: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        return { data };
      } catch (err: any) {
        const mapped = prismaErrorToHttp(err);
        set.status = mapped.status;
        return { error: mapped.message };
      }
    },
    {
      detail: { tags: ["Notifications"], summary: "Deactivate Evolution instance" },
      params: t.Object({ id: t.String() }),
    }
  )
  .post(
    "/evolution-instances/set-active",
    async ({ body, set }) => {
      try {
        const activeIds = new Set(body.activeIds);
        await minutoPrismaClient.evolutionInstance.updateMany({
          where: { id: { in: body.activeIds } },
          data: { isActive: true },
        });
        await minutoPrismaClient.evolutionInstance.updateMany({
          where: { id: { notIn: body.activeIds } },
          data: { isActive: false },
        });

        const data = await minutoPrismaClient.evolutionInstance.findMany({
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            instanceName: true,
            baseUrl: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        return { data, meta: { activeIds: Array.from(activeIds) } };
      } catch (err: any) {
        const mapped = prismaErrorToHttp(err);
        set.status = mapped.status;
        return { error: mapped.message };
      }
    },
    {
      detail: { tags: ["Notifications"], summary: "Set active Evolution instances (exclusive)" },
      body: t.Object({
        activeIds: t.Array(t.String()),
      }),
    }
  )

  // Debug endpoints (WhatsApp / Evolution)
  .post(
    "/debug/whatsapp/send",
    async ({ body, request, set }) => {
      const allowed = assertDebugAllowed(request);
      if (!allowed.ok) {
        set.status = allowed.status;
        return { error: allowed.error };
      }

      try {
        const to = normalizePhoneNumber(body.to);
        const instances = await getActiveEvolutionInstances();
        const instance = body.instanceName
          ? (() => {
              const found = instances.find((i) => i.instanceName === body.instanceName);
              if (!found) throw new Error(`Evolution instance not found/active: ${body.instanceName}`);
              return found;
            })()
          : await selectEvolutionInstance(instances);

        const result = await evolutionApiClient.sendText({
          number: to,
          text: body.message,
          instance,
        });

        return { ok: true, to, instanceName: instance.instanceName, result };
      } catch (err: any) {
        set.status = 500;
        return { ok: false, error: err?.message ?? String(err) };
      }
    },
    {
      detail: { tags: ["Notifications"], summary: "DEBUG: send WhatsApp message now via Evolution API" },
      body: t.Object({
        to: t.String(),
        message: t.String(),
        instanceName: t.Optional(t.String()),
      }),
    }
  )
  .post(
    "/debug/whatsapp/enqueue",
    async ({ body, request, set }) => {
      const allowed = assertDebugAllowed(request);
      if (!allowed.ok) {
        set.status = allowed.status;
        return { error: allowed.error };
      }

      try {
        const to = normalizePhoneNumber(body.to);
        const eventKey = createHash("sha1").update(body.message).digest("hex");
        await enqueueWhatsappNotification({
          phone: to,
          message: body.message,
          fixtureId: body.fixtureId ?? 0,
          triggerType: "DEBUG",
          subscriberId: body.subscriberId ?? "debug",
          eventKey,
        });
        set.status = 202;
        return { ok: true, queued: true, to };
      } catch (err: any) {
        set.status = 500;
        return { ok: false, error: err?.message ?? String(err) };
      }
    },
    {
      detail: { tags: ["Notifications"], summary: "DEBUG: enqueue WhatsApp job (tests BullMQ + worker + Evolution)" },
      body: t.Object({
        to: t.String(),
        message: t.String(),
        fixtureId: t.Optional(t.Number()),
        subscriberId: t.Optional(t.String()),
      }),
    }
  );
