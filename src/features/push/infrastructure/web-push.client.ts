import webpush from "web-push";
import { areNotificationsEnabled } from "../../../shared/config/notifications";

let configured = false;

function getConfig() {
  if (!areNotificationsEnabled()) {
    return {
      enabled: false,
      publicKey: null,
      privateKey: null,
      subject: null,
    };
  }

  const publicKey =
    process.env.VAPID_PUBLIC_KEY?.trim() ??
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ??
    "";
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() ?? "";
  const subject = process.env.VAPID_SUBJECT?.trim() ?? "";

  return {
    enabled: Boolean(publicKey && privateKey && subject),
    publicKey: publicKey || null,
    privateKey: privateKey || null,
    subject: subject || null,
  };
}

function ensureConfigured() {
  const config = getConfig();
  if (!config.enabled || !config.publicKey || !config.privateKey || !config.subject) {
    throw new Error("Web push is not configured");
  }

  if (!configured) {
    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    configured = true;
  }
}

export function getWebPushStatus() {
  if (!areNotificationsEnabled()) {
    return {
      enabled: false,
      vapidPublicKey: null,
    };
  }

  const config = getConfig();
  return {
    enabled: config.enabled,
    vapidPublicKey: config.publicKey,
  };
}

export async function sendWebPushNotification(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  payload: string;
}) {
  ensureConfigured();

  return webpush.sendNotification(
    {
      endpoint: input.endpoint,
      keys: {
        p256dh: input.p256dh,
        auth: input.auth,
      },
    },
    input.payload
  );
}
