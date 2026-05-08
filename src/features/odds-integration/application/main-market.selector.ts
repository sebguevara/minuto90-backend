import type { KickertechMarket } from "../../kickertech/domain/kickertech.types";

/**
 * Heurística para detectar el "mercado principal" (1X2 / moneyline) dentro
 * del catálogo de mercados de Kickertech.
 *
 * Regla pragmática:
 *  1. Si hay un market cuyo `typeName` matchea contra patrones conocidos
 *     ("1x2", "match result", "moneyline", "main line", "winner | winner"),
 *     se usa ese — preferimos el de mayor prioridad.
 *  2. Si no, fallback al primer market con todas sus odds en `value === 0`
 *     (sin handicap/total) y entre 2 y 3 selecciones.
 *
 * Devuelve `null` si no hay candidato razonable.
 */
const MAIN_MARKET_PATTERNS: Array<{ pattern: RegExp; priority: number }> = [
  { pattern: /\b1\s*x\s*2\b/i, priority: 100 },
  { pattern: /\bmatch\s*result\b/i, priority: 95 },
  { pattern: /\bmoneyline\b/i, priority: 95 },
  { pattern: /\bwinner\s*\|\s*winner\b/i, priority: 90 },
  { pattern: /\bmain\s*line\b/i, priority: 80 },
  { pattern: /\bregular\s*time\s*\|\s*main\s*line\b/i, priority: 85 },
];

const matchPriority = (name: string): number => {
  let best = 0;
  for (const { pattern, priority } of MAIN_MARKET_PATTERNS) {
    if (pattern.test(name) && priority > best) best = priority;
  }
  return best;
};

const isCleanLine = (market: KickertechMarket): boolean => {
  if (market.odds.length < 2 || market.odds.length > 3) return false;
  return market.odds.every((odd) => odd.value === 0);
};

export const selectMainMarket = (markets: KickertechMarket[]): KickertechMarket | null => {
  if (!markets.length) return null;

  const ranked = markets
    .map((market) => ({ market, priority: market.typeName ? matchPriority(market.typeName) : 0 }))
    .filter((entry) => entry.priority > 0)
    .sort((left, right) => right.priority - left.priority);

  if (ranked.length) return ranked[0]!.market;

  const fallback = markets.find((market) => isCleanLine(market));
  return fallback ?? null;
};
