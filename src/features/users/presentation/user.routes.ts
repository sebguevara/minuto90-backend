import { Elysia, t } from "elysia";
import { verifyClerkWebhook } from "../infrastructure/clerk-webhook.verifier";
import { userService } from "../application/user.service";
import { minutoPrismaClient } from "../../../lib/minuto-client";
import { logError, logInfo, logWarn } from "../../../shared/logging/logger";

function extractClerkUserData(data: any) {
  const clerkId = data.id as string;
  const email = data.email_addresses?.[0]?.email_address ?? null;
  const firstName = data.first_name ?? "";
  const lastName = data.last_name ?? "";
  const name = [firstName, lastName].filter(Boolean).join(" ") || null;
  const imageUrl = data.image_url ?? null;
  return { clerkId, email, name, imageUrl };
}

export const userRoutes = new Elysia()
  .post(
    "/api/webhooks/clerk",
    async ({ request, set }) => {
      try {
        const rawBody = await request.text();
        const svixHeaders: Record<string, string> = {
          "svix-id": request.headers.get("svix-id") ?? "",
          "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
          "svix-signature": request.headers.get("svix-signature") ?? "",
        };

        let event: any;
        try {
          event = verifyClerkWebhook(rawBody, svixHeaders);
        } catch (err: any) {
          logWarn("clerk.webhook.verification_failed", { err: err?.message ?? String(err) });
          set.status = 400;
          return { error: "Webhook verification failed" };
        }

        const eventType = event.type as string;
        const data = event.data;

        switch (eventType) {
          case "user.created": {
            const { clerkId, email, name, imageUrl } = extractClerkUserData(data);
            await userService.createFromClerk({ clerkId, email, name, imageUrl });
            logInfo("clerk.webhook.user_created", { clerkId });
            break;
          }
          case "user.updated": {
            const { clerkId, email, name, imageUrl } = extractClerkUserData(data);
            await userService.updateFromClerk(clerkId, { email, name, imageUrl });
            logInfo("clerk.webhook.user_updated", { clerkId });
            break;
          }
          case "user.deleted": {
            const clerkId = data.id as string;
            await userService.deactivateByClerkId(clerkId);
            logInfo("clerk.webhook.user_deleted", { clerkId });
            break;
          }
          default:
            logInfo("clerk.webhook.unhandled_event", { eventType });
        }

        return { received: true };
      } catch (err: any) {
        logError("clerk.webhook.failed", { err: err?.message ?? String(err) });
        set.status = 500;
        return { error: "Internal server error" };
      }
    },
    {
      detail: { tags: ["Users"], summary: "Clerk webhook handler" },
    }
  )
  .get(
    "/api/users/:clerkId/subscribers",
    async ({ params, set }) => {
      try {
        const user = await userService.findByClerkId(params.clerkId);
        if (!user) {
          set.status = 404;
          return { error: "User not found" };
        }

        const subscribers = await minutoPrismaClient.notificationSubscriber.findMany({
          where: { userId: user.id },
          include: { subscriptions: true },
          orderBy: { createdAt: "desc" },
        });

        return { data: subscribers };
      } catch (err: any) {
        logError("users.subscribers.failed", { err: err?.message ?? String(err) });
        set.status = 500;
        return { error: "Internal server error" };
      }
    },
    {
      detail: { tags: ["Users"], summary: "Get subscribers for a user" },
      params: t.Object({ clerkId: t.String() }),
    }
  )
  .get(
    "/api/users/:clerkId/subscriptions",
    async ({ params, set }) => {
      try {
        const user = await userService.findByClerkId(params.clerkId);
        if (!user) {
          set.status = 404;
          return { error: "User not found" };
        }

        const subscriptions = await minutoPrismaClient.matchSubscription.findMany({
          where: {
            subscriber: { userId: user.id },
          },
          include: { subscriber: true },
          orderBy: { matchDate: "asc" },
        });

        return { data: subscriptions };
      } catch (err: any) {
        logError("users.subscriptions.failed", { err: err?.message ?? String(err) });
        set.status = 500;
        return { error: "Internal server error" };
      }
    },
    {
      detail: { tags: ["Users"], summary: "Get subscriptions for a user" },
      params: t.Object({ clerkId: t.String() }),
    }
  );
