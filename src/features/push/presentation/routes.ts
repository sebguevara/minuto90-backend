import { Elysia, t } from "elysia";
import { logError } from "../../../shared/logging/logger";
import { requireAdmin } from "../../../shared/middleware/admin-guard";
import { areNotificationsEnabled } from "../../../shared/config/notifications";
import { pushService } from "../application/push.service";

export const pushRoutes = new Elysia({ prefix: "/api/push" })
  .get(
    "/status",
    async ({ set }) => {
      try {
        if (!areNotificationsEnabled()) {
          return { data: { enabled: false, vapidPublicKey: null } };
        }
        return pushService.getStatus();
      } catch (err: any) {
        logError("push.status.failed", { err: err?.message ?? String(err) });
        set.status = 500;
        return { error: "Internal server error" };
      }
    },
    {
      detail: { tags: ["Push"], summary: "Get web push public status" },
    }
  )
  .post(
    "/subscriptions",
    async ({ body, request, set }) => {
      try {
        if (!areNotificationsEnabled()) {
          set.status = 503;
          return { error: "Notifications are disabled" };
        }
        const clerkId = request.headers.get("x-clerk-user-id");
        const data = await pushService.upsertSubscription({
          endpoint: body.endpoint,
          p256dh: body.p256dh,
          auth: body.auth,
          userAgent: body.userAgent ?? null,
          clerkId,
        });

        return { data };
      } catch (err: any) {
        logError("push.subscription.upsert.failed", { err: err?.message ?? String(err) });
        set.status = err?.message === "Web push is not configured" ? 503 : 500;
        return {
          error:
            err?.message === "Web push is not configured"
              ? "Web push is not configured"
              : "Internal server error",
        };
      }
    },
    {
      body: t.Object({
        endpoint: t.String({ minLength: 1 }),
        p256dh: t.String({ minLength: 1 }),
        auth: t.String({ minLength: 1 }),
        userAgent: t.Optional(t.Nullable(t.String())),
      }),
      detail: { tags: ["Push"], summary: "Create or update a web push subscription" },
    }
  )
  .delete(
    "/subscriptions",
    async ({ body, set }) => {
      try {
        if (!areNotificationsEnabled()) {
          set.status = 503;
          return { error: "Notifications are disabled" };
        }
        const data = await pushService.deleteSubscriptionByEndpoint(body.endpoint);
        return { data };
      } catch (err: any) {
        logError("push.subscription.delete.failed", { err: err?.message ?? String(err) });
        set.status = 500;
        return { error: "Internal server error" };
      }
    },
    {
      body: t.Object({
        endpoint: t.String({ minLength: 1 }),
      }),
      detail: { tags: ["Push"], summary: "Delete a web push subscription by endpoint" },
    }
  )
  .post(
    "/admin/custom",
    async ({ body, request, set }) => {
      try {
        if (!areNotificationsEnabled()) {
          set.status = 503;
          return { error: "Notifications are disabled" };
        }
        const clerkId = request.headers.get("x-clerk-user-id");
        const guard = await requireAdmin(clerkId);
        if (!guard.ok) {
          set.status = guard.status;
          return { error: guard.error };
        }

        const data = await pushService.sendCustomPushNotification({
          title: body.title,
          body: body.body,
          imageUrl: body.imageUrl,
          url: body.url,
        });

        return { data };
      } catch (err: any) {
        logError("push.admin.custom.failed", { err: err?.message ?? String(err) });
        set.status = err?.message === "Web push is not configured" ? 503 : 500;
        return {
          error:
            err?.message === "Web push is not configured"
              ? "Web push is not configured"
              : "Internal server error",
        };
      }
    },
    {
      body: t.Object({
        title: t.String({ minLength: 1 }),
        body: t.String({ minLength: 1 }),
        imageUrl: t.Optional(t.Nullable(t.String())),
        url: t.Optional(t.Nullable(t.String())),
      }),
      detail: { tags: ["Push"], summary: "Send a custom push notification (admin only)" },
    }
  );
