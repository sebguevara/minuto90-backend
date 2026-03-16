import type { ApiFootballScalar } from "../domain/football.types";

function normalizeCacheValue(value: ApiFootballScalar) {
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return String(value);
}

export function serializeApiFootballParams(params?: object) {
  if (!params) return "";

  const searchParams = new URLSearchParams();
  const source = params as Record<string, unknown>;
  const keys = Object.keys(source).sort((left, right) => left.localeCompare(right));

  for (const key of keys) {
    const value = source[key];
    if (value === undefined || value === null || value === "") {
      continue;
    }

    searchParams.set(key, normalizeCacheValue(value as ApiFootballScalar));
  }

  return searchParams.toString();
}

export function buildFootballCacheKey(endpoint: string, params?: object) {
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
  const serializedParams = serializeApiFootballParams(params);

  return serializedParams
    ? `football:${normalizedEndpoint}?${serializedParams}`
    : `football:${normalizedEndpoint}`;
}
