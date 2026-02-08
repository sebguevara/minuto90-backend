type Level = "info" | "warn" | "error";

function base(level: Level, msg: string, meta?: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(meta ? { meta } : {}),
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logInfo = (msg: string, meta?: Record<string, unknown>) => base("info", msg, meta);
export const logWarn = (msg: string, meta?: Record<string, unknown>) => base("warn", msg, meta);
export const logError = (msg: string, meta?: Record<string, unknown>) => base("error", msg, meta);

