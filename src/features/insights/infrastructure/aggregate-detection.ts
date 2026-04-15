/**
 * Knockout/aggregate round detection utilities.
 * Ported from frontend aggregate.utils.ts for use in backend analysis prompts.
 */

function normalizeRound(round?: string | null): string {
  return typeof round === "string" ? round.toLowerCase() : "";
}

/** Detects whether a round string indicates a second leg (vuelta). */
export function isSecondLegRound(round?: string | null): boolean {
  const lower = normalizeRound(round);
  return (
    lower.includes("leg 2") ||
    lower.includes("2nd leg") ||
    lower.includes("segunda leg") ||
    lower.includes("vuelta")
  );
}

/** Detects whether a round string indicates a first leg (ida). */
export function isFirstLegRound(round?: string | null): boolean {
  const lower = normalizeRound(round);
  return (
    lower.includes("leg 1") ||
    lower.includes("1st leg") ||
    lower.includes("primera leg") ||
    lower.includes("ida")
  );
}

/** Detects whether a round could be part of a two-legged aggregate tie. */
export function isPotentialAggregateRound(round?: string | null): boolean {
  return isFirstLegRound(round) || isSecondLegRound(round);
}
