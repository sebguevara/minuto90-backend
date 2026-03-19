import { logWarn } from "../../../shared/logging/logger";
import { redisConnection } from "../../../shared/redis/redis.connection";

export interface InsightsCacheStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  setNx(key: string, value: string, ttlSeconds: number): Promise<boolean>;
  del(key: string): Promise<void>;
}

export class RedisInsightsCacheStore implements InsightsCacheStore {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await redisConnection.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (error) {
      logWarn("insights.cache.get_failed", {
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
      logWarn("insights.cache.set_failed", {
        key,
        ttlSeconds,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    if (ttlSeconds <= 0) return false;
    try {
      const res = await redisConnection.set(key, value, "EX", ttlSeconds, "NX");
      return res === "OK";
    } catch (error) {
      logWarn("insights.cache.setnx_failed", {
        key,
        ttlSeconds,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await redisConnection.del(key);
    } catch (error) {
      logWarn("insights.cache.del_failed", {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const redisInsightsCacheStore = new RedisInsightsCacheStore();

