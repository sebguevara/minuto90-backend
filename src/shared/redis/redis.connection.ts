import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:9060/0";

// BullMQ recommends `maxRetriesPerRequest: null` to avoid stalled jobs.
export const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

redisConnection.on("error", (err) => {
  // Centralized visibility; workers/API can still decide whether to exit.
  // eslint-disable-next-line no-console
  console.error("redis.connection.error", err?.message ?? String(err));
});
