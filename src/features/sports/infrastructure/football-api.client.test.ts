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

class MemoryCacheStore implements FootballCacheStore {
  private readonly storage = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | null> {
    return (this.storage.get(key) as T | undefined) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.storage.set(key, value);
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

  it("traduce rate limit upstream a error de dominio en español", async () => {
    const client = createClient({
      fetchFn: async () =>
        new Response(JSON.stringify({ message: "Too many requests" }), { status: 429 }),
    });

    await expect(client.getFixtures({ live: "all" })).rejects.toMatchObject({
      status: 429,
      message: "La consulta excedió el límite permitido",
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
});
