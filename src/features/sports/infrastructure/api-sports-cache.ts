import type { ApiSportsScalar } from "../domain/api-sports.shared";

function normalizeCacheValue(value: ApiSportsScalar) {
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return String(value);
}

export function serializeApiSportsParams(params?: object) {
  if (!params) return "";

  const searchParams = new URLSearchParams();
  const source = params as Record<string, unknown>;
  const keys = Object.keys(source).sort((left, right) => left.localeCompare(right));

  for (const key of keys) {
    const value = source[key];
    if (value === undefined || value === null || value === "") {
      continue;
    }

    searchParams.set(key, normalizeCacheValue(value as ApiSportsScalar));
  }

  return searchParams.toString();
}

export function buildApiSportsCacheKey(sport: string, endpoint: string, params?: object) {
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
  const serializedParams = serializeApiSportsParams(params);

  return serializedParams
    ? `${sport}:${normalizedEndpoint}?${serializedParams}`
    : `${sport}:${normalizedEndpoint}`;
}

