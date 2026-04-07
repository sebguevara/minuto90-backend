import { Elysia, t } from "elysia";
import { verifyClerkWebhook } from "../infrastructure/clerk-webhook.verifier";
import { userService } from "../application/user.service";
import { minutoPrismaClient } from "../../../lib/minuto-client";
import { logError, logInfo, logWarn } from "../../../shared/logging/logger";
import { userNotificationSettingsService } from "../../notifications/application/user-notification-settings.service";

function normalizeNullableString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function splitDisplayName(displayName: string | null) {
  if (!displayName) return { firstName: null, lastName: null };

  const parts = displayName
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: null };

  return {
    firstName: parts[0]!,
    lastName: parts.slice(1).join(" "),
  };
}

function getExternalAccountDisplayName(data: any) {
  const accountWithName = data.external_accounts?.find?.(
    (account: any) => account?.first_name || account?.last_name
  );

  if (!accountWithName) return null;

  return normalizeNullableString(
    `${accountWithName.first_name ?? ""} ${accountWithName.last_name ?? ""}`
  );
}

function extractClerkUserData(data: any) {
  const clerkId = data.id as string;
  const email = normalizeNullableString(data.email_addresses?.[0]?.email_address);
  const imageUrl =
    normalizeNullableString(data.image_url) ??
    normalizeNullableString(data.profile_image_url) ??
    null;

  const directFirstName = normalizeNullableString(data.first_name);
  const directLastName = normalizeNullableString(data.last_name);

  const fallbackDisplayName =
    normalizeNullableString(data.full_name) ??
    normalizeNullableString(data.username) ??
    getExternalAccountDisplayName(data) ??
    (email ? email.split("@")[0] : null);

  const splitFallback = splitDisplayName(fallbackDisplayName);

  const firstName = directFirstName ?? splitFallback.firstName;
  const lastName = directLastName ?? splitFallback.lastName;
  const name =
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    fallbackDisplayName ||
    null;

  return { clerkId, email, firstName, lastName, name, imageUrl };
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
            const { clerkId, email, firstName, lastName, name, imageUrl } = extractClerkUserData(data);
            await userService.createFromClerk({ clerkId, email, firstName, lastName, name, imageUrl });
            logInfo("clerk.webhook.user_created", { clerkId });
            break;
          }
          case "user.updated": {
            const { clerkId, email, firstName, lastName, name, imageUrl } = extractClerkUserData(data);
            await userService.updateFromClerk(clerkId, { email, firstName, lastName, name, imageUrl });
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
    "/api/users/:clerkId/profile",
    async ({ params, set }) => {
      try {
        const user = await userService.findByClerkId(params.clerkId);
        if (!user) {
          set.status = 404;
          return { error: "User not found" };
        }
        return {
          data: {
            id: user.id,
            clerkId: user.clerkId,
            firstName: (user as any).firstName ?? null,
            lastName: (user as any).lastName ?? null,
            name: user.name,
            email: user.email,
            imageUrl: user.imageUrl,
            role: (user as any).role ?? "user",
          },
        };
      } catch (err: any) {
        logError("users.profile.failed", { err: err?.message ?? String(err) });
        set.status = 500;
        return { error: "Internal server error" };
      }
    },
    {
      detail: { tags: ["Users"], summary: "Get user profile with role" },
      params: t.Object({ clerkId: t.String() }),
    }
  )
  .get(
    "/api/users/:clerkId/notification-settings",
    async ({ params, set }) => {
      try {
        return await userNotificationSettingsService.getSettingsByClerkId(params.clerkId);
      } catch (err: any) {
        logError("users.notification_settings.get_failed", {
          clerkId: params.clerkId,
          err: err?.message ?? String(err),
        });
        set.status = err?.message === "User not found" ? 404 : 500;
        return { error: err?.message === "User not found" ? "User not found" : "Internal server error" };
      }
    },
    {
      detail: { tags: ["Users"], summary: "Get notification settings for a user" },
      params: t.Object({ clerkId: t.String() }),
    }
  )
  .patch(
    "/api/users/:clerkId/notification-settings",
    async ({ params, body, set }) => {
      try {
        return await userNotificationSettingsService.updateSettingsByClerkId(params.clerkId, body);
      } catch (err: any) {
        logError("users.notification_settings.patch_failed", {
          clerkId: params.clerkId,
          err: err?.message ?? String(err),
        });
        if (err?.message === "User not found") {
          set.status = 404;
          return { error: "User not found" };
        }
        if (String(err?.message ?? "").startsWith("Invalid ")) {
          set.status = 400;
          return { error: err.message };
        }
        if (err?.status === 409 || err?.message === "Phone number already linked to another account") {
          set.status = 409;
          return { error: "Phone number already linked to another account" };
        }
        set.status = 500;
        return { error: "Internal server error" };
      }
    },
    {
      detail: { tags: ["Users"], summary: "Update notification settings for a user" },
      params: t.Object({ clerkId: t.String() }),
      body: t.Object({
        name: t.Optional(t.Nullable(t.String())),
        countryCode: t.Optional(t.Nullable(t.String())),
        dialCode: t.Optional(t.Nullable(t.String())),
        nationalNumber: t.Optional(t.Nullable(t.String())),
        isActive: t.Optional(t.Boolean()),
        notifyPreMatch30m: t.Optional(t.Boolean()),
        notifyKickoff: t.Optional(t.Boolean()),
        notifyGoals: t.Optional(t.Boolean()),
        notifyRedCards: t.Optional(t.Boolean()),
        notifyVarCancelled: t.Optional(t.Boolean()),
        notifyHalftime: t.Optional(t.Boolean()),
        notifySecondHalf: t.Optional(t.Boolean()),
        notifyFullTime: t.Optional(t.Boolean()),
      }),
    }
  )
  .get(
    "/api/users/:clerkId/notification-status",
    async ({ params, set }) => {
      try {
        return await userNotificationSettingsService.getStatusByClerkId(params.clerkId);
      } catch (err: any) {
        logError("users.notification_status.get_failed", {
          clerkId: params.clerkId,
          err: err?.message ?? String(err),
        });
        set.status = err?.message === "User not found" ? 404 : 500;
        return { error: err?.message === "User not found" ? "User not found" : "Internal server error" };
      }
    },
    {
      detail: { tags: ["Users"], summary: "Get notification status for a user" },
      params: t.Object({ clerkId: t.String() }),
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
