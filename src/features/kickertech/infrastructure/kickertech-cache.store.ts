import { logWarn } from "../../../shared/logging/logger";
import { redisConnection } from "../../../shared/redis/redis.connection";

export interface KickertechCacheStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}

export class RedisKickertechCacheStore implements KickertechCacheStore {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await redisConnection.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (error) {
      logWarn("kickertech.cache.get_failed", {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;

    try {
      await redisConnection.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch (error) {
      logWarn("kickertech.cache.set_failed", {
        key,
        ttlSeconds,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async del(key: string): Promise<void> {
    try {
      await redisConnection.del(key);
    } catch (error) {
      logWarn("kickertech.cache.del_failed", {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const redisKickertechCacheStore = new RedisKickertechCacheStore();
