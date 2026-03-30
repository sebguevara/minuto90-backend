import { logWarn } from "../../../shared/logging/logger";
import { redisConnection } from "../../../shared/redis/redis.connection";

export interface FootballCacheStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del?(key: string): Promise<void>;
  setNx?<T>(key: string, value: T, ttlSeconds: number): Promise<boolean>;
}

export class RedisFootballCacheStore implements FootballCacheStore {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await redisConnection.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (error) {
      logWarn("football.cache.get_failed", {
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
      logWarn("football.cache.set_failed", {
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
      logWarn("football.cache.del_failed", {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async setNx<T>(key: string, value: T, ttlSeconds: number): Promise<boolean> {
    if (ttlSeconds <= 0) return false;

    try {
      const result = await redisConnection.set(
        key,
        JSON.stringify(value),
        "EX",
        ttlSeconds,
        "NX"
      );
      return result === "OK";
    } catch (error) {
      logWarn("football.cache.setnx_failed", {
        key,
        ttlSeconds,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}

export const redisFootballCacheStore = new RedisFootballCacheStore();
