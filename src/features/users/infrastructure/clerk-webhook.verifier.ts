import { Webhook } from "svix";

const CLERK_WEBHOOK_SECRET =
  process.env.CLERK_WEBHOOK_SECRET ??
  process.env.CLERK_WEBHOOK_SIGNING_SECRET ??
  process.env.CLERK_WEBOOK ??
  "";

export function verifyClerkWebhook(rawBody: string, headers: Record<string, string>): unknown {
  if (!CLERK_WEBHOOK_SECRET) {
    throw new Error(
      "Missing Clerk webhook secret. Set CLERK_WEBHOOK_SECRET, CLERK_WEBHOOK_SIGNING_SECRET, or CLERK_WEBOOK."
    );
  }

  const wh = new Webhook(CLERK_WEBHOOK_SECRET);
  return wh.verify(rawBody, {
    "svix-id": headers["svix-id"] ?? "",
    "svix-timestamp": headers["svix-timestamp"] ?? "",
    "svix-signature": headers["svix-signature"] ?? "",
  });
}
