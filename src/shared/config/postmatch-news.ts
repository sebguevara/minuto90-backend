/**
 * Feature flag + tunables for the AI post-match news generator.
 * Disabled by default so it can be rolled out gradually via env.
 */
const TRUE_VALUES = new Set(["1", "true", "on", "yes"]);

export function isPostMatchNewsEnabled(): boolean {
  const raw = process.env.POSTMATCH_NEWS_ENABLED?.trim().toLowerCase();
  if (!raw) return false; // default OFF
  return TRUE_VALUES.has(raw);
}

/** Delay before generating, so api-football consolidates final stats/players/lineups. */
export function getPostMatchNewsDelayMs(): number {
  const n = Number(process.env.POSTMATCH_NEWS_DELAY_MS);
  return Number.isFinite(n) && n >= 0 ? n : 180_000; // 3 min
}

export function getPostMatchNewsCategorySlug(): string {
  return process.env.POSTMATCH_NEWS_CATEGORY_SLUG?.trim() || "resultados";
}

export function getPostMatchNewsCategoryName(): string {
  return process.env.POSTMATCH_NEWS_CATEGORY_NAME?.trim() || "Resultados";
}

/** Reuses the same model the existing post-match summary uses. */
export const POSTMATCH_NEWS_MODEL = process.env.POSTMATCH_NEWS_MODEL?.trim() || "gpt-5-mini";

/** Author shown on AI-generated notes (the team adds the image later). */
export const POSTMATCH_NEWS_AUTHOR = "minuto90";
