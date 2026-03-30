import { describe, expect, it } from "bun:test";
import type {
  ApiFootballFixturesEnvelope,
  ApiFootballTimezoneEnvelope,
} from "../domain/football.types";
import { FootballModuleError } from "../domain/football.errors";
import {
  FootballApiClient,
  type FootballApiClientOptions,
} from "./football-api.client";
import type { FootballCacheStore } from "./football-cache.store";
import { buildFootballCacheKey } from "./football-cache-key";

class MemoryCacheStore implements FootballCacheStore {
  private readonly storage = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | null> {
    return (this.storage.get(key) as T | undefined) ?? null;
  }

  async set<T>(key: string, value: T, _ttlSeconds?: number): Promise<void> {
    this.storage.set(key, value);
  }

  async del(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async setNx<T>(key: string, value: T, _ttlSeconds?: number): Promise<boolean> {
    if (this.storage.has(key)) {
      return false;
    }

    this.storage.set(key, value);
    return true;
  }
}

function createClient(options: Partial<FootballApiClientOptions> = {}) {
  return new FootballApiClient({
    baseUrl: "https://example.test",
    apiKey: "secret",
    cache: new MemoryCacheStore(),
    ...options,
  });
}

describe("football-api.client", () => {
  it("serializa params en orden estable y reutiliza cache", async () => {
    let fetchCalls = 0;
    let requestedUrl = "";

    const envelope: ApiFootballFixturesEnvelope = {
      get: "fixtures",
      parameters: { league: "39", live: "all", season: "2024" },
      errors: [],
      results: 0,
      paging: { current: 1, total: 1 },
      response: [],
    };

    const client = createClient({
      fetchFn: async (input) => {
        fetchCalls += 1;
        requestedUrl = String(input);
        return new Response(JSON.stringify(envelope), { status: 200 });
      },
    });

    const first = await client.getFixtures({ season: 2024, live: "all", league: 39 });
    const second = await client.getFixtures({ league: 39, season: 2024, live: "all" });

    expect(first).toEqual(envelope);
    expect(second).toEqual(envelope);
    expect(fetchCalls).toBe(1);
    expect(requestedUrl).toBe("https://example.test/fixtures?league=39&live=all&season=2024");
  });

  it("traduce rate limit upstream a error de dominio en espanol", async () => {
    const client = createClient({
      fetchFn: async () =>
        new Response(JSON.stringify({ message: "Too many requests" }), { status: 429 }),
    });

    await expect(client.getFixtures({ live: "all" })).rejects.toMatchObject({
      status: 429,
      message: "La consulta excedio el limite permitido",
    } satisfies Partial<FootballModuleError>);
  });

  it("acepta envelopes sin paging para endpoints como timezone", async () => {
    const envelope: ApiFootballTimezoneEnvelope = {
      get: "timezone",
      parameters: {},
      errors: [],
      results: 2,
      response: ["Africa/Abidjan", "Africa/Accra"],
    };

    const client = createClient({
      fetchFn: async () => new Response(JSON.stringify(envelope), { status: 200 }),
    });

    const result = await client.getTimezone();
    expect(result).toEqual(envelope);
  });

  it("deduplica requests concurrentes al mismo fixture", async () => {
    let fetchCalls = 0;
    const envelope: ApiFootballFixturesEnvelope = {
      get: "fixtures",
      parameters: { id: "1494568" },
      errors: [],
      results: 1,
      paging: { current: 1, total: 1 },
      response: [{ fixture: { id: 1494568 } }],
    } as unknown as ApiFootballFixturesEnvelope;

    const client = createClient({
      fetchFn: async () => {
        fetchCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 40));
        return new Response(JSON.stringify(envelope), { status: 200 });
      },
    });

    const [first, second] = await Promise.all([
      client.getFixtures({ id: 1494568 }),
      client.getFixtures({ id: 1494568 }),
    ]);

    expect(first).toEqual(envelope);
    expect(second).toEqual(envelope);
    expect(fetchCalls).toBe(1);
  });

  it("sirve stale last_good y activa cooldown despues de timeout en fixture puntual", async () => {
    const cache = new MemoryCacheStore();
    let fetchCalls = 0;
    const fixtureId = 1378130;
    const envelope: ApiFootballFixturesEnvelope = {
      get: "fixtures",
      parameters: { id: String(fixtureId) },
      errors: [],
      results: 1,
      paging: { current: 1, total: 1 },
      response: [{ fixture: { id: fixtureId } }],
    } as unknown as ApiFootballFixturesEnvelope;

    const client = createClient({
      cache,
      fetchFn: async () => {
        fetchCalls += 1;
        if (fetchCalls === 1) {
          return new Response(JSON.stringify(envelope), { status: 200 });
        }

        const timeoutError = Object.assign(new Error("The operation timed out."), {
          name: "TimeoutError",
          code: 23,
        });
        throw timeoutError;
      },
    });

    const cacheKey = buildFootballCacheKey("/fixtures", { id: fixtureId });
    const first = await client.getFixtures({ id: fixtureId });
    expect(first).toEqual(envelope);

    await cache.del(cacheKey);

    const stale = await client.getFixtures({ id: fixtureId });
    expect(stale).toEqual(envelope);
    expect(fetchCalls).toBe(2);

    const secondStale = await client.getFixtures({ id: fixtureId });
    expect(secondStale).toEqual(envelope);
    expect(fetchCalls).toBe(2);
  });

  it("devuelve cooldown estructurado cuando no existe stale para un timeout puntual", async () => {
    let fetchCalls = 0;
    const fixtureId = 1489345;
    const client = createClient({
      fetchFn: async () => {
        fetchCalls += 1;
        const timeoutError = Object.assign(new Error("The operation timed out."), {
          name: "TimeoutError",
          code: 23,
        });
        throw timeoutError;
      },
    });

    await expect(client.getFixtures({ id: fixtureId })).rejects.toMatchObject({
      status: 503,
      code: "FIXTURE_TIMEOUT_COOLDOWN",
      details: {
        fixtureId,
        cacheStatus: "miss",
      },
    } satisfies Partial<FootballModuleError>);

    await expect(client.getFixtures({ id: fixtureId })).rejects.toMatchObject({
      status: 503,
      code: "FIXTURE_TIMEOUT_COOLDOWN",
    } satisfies Partial<FootballModuleError>);

    expect(fetchCalls).toBe(1);
  });
});
