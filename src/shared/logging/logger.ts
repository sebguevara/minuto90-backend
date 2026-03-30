type Level = "info" | "warn" | "error";

function formatMetaValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatMetaSuffix(meta?: Record<string, unknown>) {
  if (!meta) return "";
  const entries = Object.entries(meta).filter(([, value]) => value !== undefined);
  if (!entries.length) return "";
  return ` ${entries.map(([key, value]) => `${key}=${formatMetaValue(value)}`).join(" ")}`;
}

function base(level: Level, msg: string, meta?: Record<string, unknown>) {
  if (level !== "error") {
    return;
  }

  const payload = {
    ts: new Date().toISOString(),
    level,
    msg: `${msg}${formatMetaSuffix(meta)}`,
    ...(meta ?? {}),
    ...(meta ? { meta } : {}),
  };
  const line = JSON.stringify(payload);
  console.error(line);
}

export const logInfo = (msg: string, meta?: Record<string, unknown>) => base("info", msg, meta);
export const logWarn = (msg: string, meta?: Record<string, unknown>) => base("warn", msg, meta);
export const logError = (msg: string, meta?: Record<string, unknown>) => base("error", msg, meta);
