/**
 * Pure (IO-free) logic for the AI post-match news generator. Kept separate from the
 * service so it can be unit-tested with `bun test` (see match-news.logic.test.ts).
 */
import {
  isFirstLegRound,
  isSecondLegRound,
} from "../../insights/infrastructure/aggregate-detection";

// ---------------------------------------------------------------------------
// Slugify
// ---------------------------------------------------------------------------

/** Same slug normalization used across the news admin (tag.service, editor form). */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Builds a unique, stable slug for a generated match note. The fixtureId suffix
 * guarantees uniqueness against the `News.slug @unique` constraint (one note per match).
 */
export function buildMatchNewsSlug(title: string, fixtureId: number): string {
  const base = slugify(title).slice(0, 80).replace(/-+$/g, "");
  const safeBase = base || "cronica";
  return `${safeBase}-${fixtureId}`;
}

// ---------------------------------------------------------------------------
// HTML sanitization — ported from frontend src/shared/lib/news-content.ts
// so the automated (non-frontend) path produces the same safe HTML the public
// renderer expects.
// ---------------------------------------------------------------------------

const ALLOWED_TAGS = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "div",
  "em",
  "h2",
  "h3",
  "h4",
  "hr",
  "i",
  "li",
  "ol",
  "p",
  "strong",
  "u",
  "ul",
]);

export function sanitizeNewsHtml(rawHtml: string | null | undefined): string {
  const input = (rawHtml ?? "").trim();
  if (!input) return "";

  const withoutDangerousBlocks = input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?>[\s\S]*?<\/embed>/gi, "");

  return withoutDangerousBlocks.replace(
    /<\/?([a-z0-9-]+)([^>]*)>/gi,
    (fullMatch, rawTagName: string, rawAttrs: string) => {
      const tagName = rawTagName.toLowerCase();
      if (!ALLOWED_TAGS.has(tagName)) {
        return "";
      }

      if (fullMatch.startsWith("</")) {
        return `</${tagName}>`;
      }

      if (tagName !== "a") {
        return `<${tagName}>`;
      }

      const hrefMatch = rawAttrs.match(/\shref\s*=\s*(['"])(.*?)\1/i);
      const href = hrefMatch?.[2]?.trim() ?? "";

      if (!href || /^javascript:/i.test(href)) {
        return "<a>";
      }

      return `<a href="${href.replace(/"/g, "&quot;")}" target="_blank" rel="noopener noreferrer nofollow">`;
    }
  );
}

// ---------------------------------------------------------------------------
// Tournament phase classification
// ---------------------------------------------------------------------------

export type TournamentPhase = "league" | "group" | "knockout" | "single";

const KNOCKOUT_ROUND_PATTERN =
  /final|semi|quarter|cuartos|octavos|round of|1\/8|1\/4|1\/2|play-?off|playoff|knockout|eliminat|preliminary|qualifying round|relegation round|promotion/i;

const GROUP_ROUND_PATTERN = /group|grupo|league stage|group stage/i;

/**
 * Classifies the competition phase a fixture belongs to from its api-football
 * `round` string and (optionally) its competition type ("League" | "Cup").
 *
 * - "group"    → group / league stage of a cup or international tournament.
 * - "knockout" → two-legged tie, single-leg decider, or any final/semi/round-of-N.
 * - "league"   → regular round-robin league round (standings table applies).
 * - "single"   → friendlies / unclassifiable (no standings, no aggregate).
 */
export function classifyTournamentPhase(input: {
  round?: string | null;
  competitionType?: "League" | "Cup" | null;
}): TournamentPhase {
  const round = typeof input.round === "string" ? input.round : "";
  const lower = round.toLowerCase();

  // Friendlies are neither league nor knockout.
  if (/friendl|amistoso/i.test(lower)) return "single";

  if (GROUP_ROUND_PATTERN.test(lower)) return "group";

  if (isFirstLegRound(round) || isSecondLegRound(round) || KNOCKOUT_ROUND_PATTERN.test(lower)) {
    return "knockout";
  }

  // Explicit numbered league rounds: "Regular Season - 5", "Apertura - 3", "Jornada 12",
  // "Round 5", "Week 8". (A bare "1st Round" in a cup is intentionally NOT matched here.)
  if (/regular season|jornada|matchday|apertura|clausura|fecha\b|week\s*\d|^round\s*\d/i.test(lower)) {
    return "league";
  }

  // Fallback by competition type: a Cup with an unrecognized non-group round is a knockout
  // round (e.g. "1st Round", "Preliminary"); a League is a league round.
  if (input.competitionType === "Cup") return "knockout";
  if (input.competitionType === "League") return "league";

  return "single";
}

// ---------------------------------------------------------------------------
// Tolerant parsing of the model's JSON output
// ---------------------------------------------------------------------------

export type MatchNewsDraftContent = {
  title: string;
  summary: string;
  bodyHtml: string;
  hashtags: string[];
};

function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.replace(/^#+/, "").trim())
    .filter(Boolean);
}

/**
 * Parses the structured article the model returns. Tolerates ```json fences and
 * surrounding prose by extracting the first balanced-looking JSON object. Returns
 * null when the payload is unusable (caller logs + skips).
 */
export function parseMatchNewsDraft(raw: string | null | undefined): MatchNewsDraftContent | null {
  const text = (raw ?? "").trim();
  if (!text) return null;

  const tryObject = (candidate: string): MatchNewsDraftContent | null => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(candidate) as Record<string, unknown>;
    } catch {
      return null;
    }
    if (!parsed || typeof parsed !== "object") return null;

    const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
    const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
    const bodyHtml =
      typeof parsed.bodyHtml === "string"
        ? parsed.bodyHtml.trim()
        : typeof parsed.body === "string"
          ? (parsed.body as string).trim()
          : "";
    const hashtags = coerceStringArray(parsed.hashtags ?? parsed.tags);

    if (!title || !bodyHtml) return null;
    return { title, summary, bodyHtml, hashtags };
  };

  const stripped = text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  const direct = tryObject(stripped);
  if (direct) return direct;

  const block = stripped.match(/\{[\s\S]*\}/);
  if (block) {
    const nested = tryObject(block[0]);
    if (nested) return nested;
  }

  return null;
}
