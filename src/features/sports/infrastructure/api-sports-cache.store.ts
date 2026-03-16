import { logWarn } from "../../../shared/logging/logger";
import { redisConnection } from "../../../shared/redis/redis.connection";

export interface ApiSportsCacheStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
}

export class RedisApiSportsCacheStore implements ApiSportsCacheStore {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await redisConnection.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (error) {
      logWarn("api_sports.cache.get_failed", {
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
      logWarn("api_sports.cache.set_failed", {
        key,
        ttlSeconds,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const redisApiSportsCacheStore = new RedisApiSportsCacheStore();

