import { redisConnection } from "../../../shared/redis/redis.connection";
import type { EvolutionInstanceConfig } from "./evolution-api.client";

const ROUND_ROBIN_KEY = "evolution:rr";

export async function selectEvolutionInstance(instances: EvolutionInstanceConfig[]): Promise<EvolutionInstanceConfig> {
  if (!instances.length) {
    throw new Error("No Evolution instances available");
  }
  if (instances.length === 1) return instances[0];

  const n = instances.length;
  const idxRaw = await redisConnection.incr(ROUND_ROBIN_KEY);
  const idx = ((typeof idxRaw === "number" ? idxRaw : Number(idxRaw)) - 1) % n;
  return instances[idx];
}
