import { Elysia, t } from "elysia";
import { logError } from "../../../shared/logging/logger";
import { pushService } from "../application/push.service";

export const pushRoutes = new Elysia({ prefix: "/api/push" })
  .get(
    "/status",
    async ({ set }) => {
      try {
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
  );
