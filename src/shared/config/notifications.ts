const FALSE_VALUES = new Set(["0", "false", "off", "no"]);

export function areNotificationsEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_NOTIFICATIONS_ENABLED?.trim().toLowerCase();
  if (!raw) return true;
  return !FALSE_VALUES.has(raw);
}
