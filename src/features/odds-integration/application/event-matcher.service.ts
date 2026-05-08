import type {
  MatcherCandidate,
  MatcherFixtureInput,
  MatcherResult,
  OddsSource,
} from "../domain/odds-integration.types";
import {
  normalizeTeamName,
  tokenizeTeamName,
} from "../infrastructure/normalize-team-name";
import {
  teamAliasRepository,
  type TeamAliasRepository,
} from "../infrastructure/team-alias.repository";

/**
 * Matcher automático evento↔fixture.
 *
 * Algoritmo:
 *  1. Filtrado temporal: candidatos cuyo `dateStart` está dentro de la ventana
 *     configurada (default ±15 min) respecto del fixture.
 *  2. Por cada candidato, scoring:
 *       - timeScore: 1.0 dentro de ±5min, decae lineal a 0 en el borde de la ventana.
 *       - homeScore / awayScore: alias hit (1.0) > exacto normalizado (0.95)
 *         > token-Jaccard alto > Levenshtein-ratio. <0.5 = rechaza.
 *       - score = 0.2*time + 0.4*home + 0.4*away.
 *       - Se prueba también el orden invertido (home↔away) por si el proveedor
 *         los reportó al revés; al match invertido se le aplica una penalización.
 *  3. Se elige el candidato con mejor score; si ≥ threshold (default 0.85),
 *     se acepta. Si no, falla con `bestConfidence` informativo.
 *
 * Toda la lógica es pura excepto el lookup de aliases (inyectable para tests).
 */

export interface EventMatcherOptions {
  /** Ventana temporal en minutos (±). Default 15. */
  timeWindowMinutes?: number;
  /** Confianza mínima para aceptar el match. Default 0.85. */
  acceptThreshold?: number;
  /** Penalización aplicada al match invertido (home↔away). Default 0.05. */
  reversePenalty?: number;
}

export interface EventMatcherServiceContract {
  match(input: {
    source: OddsSource;
    sportId: number;
    fixture: MatcherFixtureInput;
    candidates: MatcherCandidate[];
    options?: EventMatcherOptions;
  }): Promise<MatcherResult>;
}

const DEFAULT_TIME_WINDOW_MIN = 15;
const DEFAULT_ACCEPT_THRESHOLD = 0.85;
const DEFAULT_REVERSE_PENALTY = 0.05;
const SHARP_TIME_WINDOW_MIN = 5;

/** Score temporal: 1.0 ≤5min; lineal a 0 en el borde de la ventana. */
const computeTimeScore = (
  fixtureMs: number,
  candidateMs: number,
  windowMinutes: number
): number => {
  const diffMin = Math.abs(fixtureMs - candidateMs) / 60_000;
  if (diffMin > windowMinutes) return 0;
  if (diffMin <= SHARP_TIME_WINDOW_MIN) return 1;
  const span = Math.max(windowMinutes - SHARP_TIME_WINDOW_MIN, 1);
  return Math.max(0, 1 - (diffMin - SHARP_TIME_WINDOW_MIN) / span);
};

/** Distancia de Levenshtein (programación dinámica clásica). */
const levenshtein = (left: string, right: string): number => {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const previous = new Array<number>(right.length + 1);
  for (let index = 0; index <= right.length; index += 1) previous[index] = index;

  for (let i = 1; i <= left.length; i += 1) {
    let prev = previous[0]!;
    previous[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const temp = previous[j]!;
      const cost = left.charCodeAt(i - 1) === right.charCodeAt(j - 1) ? 0 : 1;
      previous[j] = Math.min(
        previous[j]! + 1, // deletion
        previous[j - 1]! + 1, // insertion
        prev + cost // substitution
      );
      prev = temp;
    }
  }
  return previous[right.length]!;
};

const levenshteinRatio = (left: string, right: string): number => {
  const maxLen = Math.max(left.length, right.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(left, right) / maxLen;
};

const jaccardTokens = (left: string, right: string): number => {
  const a = new Set(tokenizeTeamName(left));
  const b = new Set(tokenizeTeamName(right));
  if (!a.size && !b.size) return 1;
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
};

interface TeamScoreContext {
  source: OddsSource;
  sportId: number;
  apifootballTeamId: number | null;
  apifootballName: string;
  externalName: string;
  aliasRepo: TeamAliasRepository;
}

interface TeamScoreResult {
  score: number;
  matchedBy: "alias" | "exact" | "fuzzy";
}

const scoreTeam = async (ctx: TeamScoreContext): Promise<TeamScoreResult> => {
  const externalNormalized = normalizeTeamName(ctx.externalName);
  const officialNormalized = normalizeTeamName(ctx.apifootballName);

  if (!externalNormalized || !officialNormalized) {
    return { score: 0, matchedBy: "fuzzy" };
  }

  // 1. Alias persistido — la señal más fuerte.
  if (ctx.apifootballTeamId !== null) {
    const alias = await ctx.aliasRepo.findByNormalizedName(
      ctx.source,
      ctx.sportId,
      externalNormalized
    );
    if (alias && alias.apifootballTeamId === ctx.apifootballTeamId) {
      return { score: 1, matchedBy: "alias" };
    }
  }

  // 2. Coincidencia exacta tras normalizar.
  if (externalNormalized === officialNormalized) {
    return { score: 0.95, matchedBy: "exact" };
  }

  // 3. Combinación token-Jaccard + Levenshtein. Tomamos el máximo, escalado.
  const jaccard = jaccardTokens(externalNormalized, officialNormalized);
  const lev = levenshteinRatio(externalNormalized, officialNormalized);
  const score = Math.max(jaccard, lev) * 0.95;
  return { score, matchedBy: "fuzzy" };
};

interface ScoredCandidate {
  candidate: MatcherCandidate;
  total: number;
  timeScore: number;
  homeScore: number;
  awayScore: number;
  matchedBy: "alias" | "exact" | "fuzzy";
  reversed: boolean;
}

const combineScores = (timeScore: number, homeScore: number, awayScore: number) =>
  timeScore * 0.2 + homeScore * 0.4 + awayScore * 0.4;

const pickStrongerMatchedBy = (
  a: "alias" | "exact" | "fuzzy",
  b: "alias" | "exact" | "fuzzy"
): "alias" | "exact" | "fuzzy" => {
  const rank = { alias: 3, exact: 2, fuzzy: 1 } as const;
  return rank[a] >= rank[b] ? a : b;
};

export class EventMatcherService implements EventMatcherServiceContract {
  constructor(private readonly aliasRepo: TeamAliasRepository = teamAliasRepository) {}

  async match(input: {
    source: OddsSource;
    sportId: number;
    fixture: MatcherFixtureInput;
    candidates: MatcherCandidate[];
    options?: EventMatcherOptions;
  }): Promise<MatcherResult> {
    const windowMinutes = input.options?.timeWindowMinutes ?? DEFAULT_TIME_WINDOW_MIN;
    const acceptThreshold = input.options?.acceptThreshold ?? DEFAULT_ACCEPT_THRESHOLD;
    const reversePenalty = input.options?.reversePenalty ?? DEFAULT_REVERSE_PENALTY;

    const fixtureMs = Date.parse(input.fixture.date);
    if (!Number.isFinite(fixtureMs)) {
      return { matched: false, bestConfidence: 0, reason: "no_candidates_in_time_window" };
    }

    // Filtro temporal antes del scoring (rechaza por fecha mucho más rápido).
    const candidatesInWindow = input.candidates.filter((candidate) => {
      const ms = Date.parse(candidate.dateStart);
      if (!Number.isFinite(ms)) return false;
      return Math.abs(ms - fixtureMs) <= windowMinutes * 60_000;
    });

    if (!candidatesInWindow.length) {
      return { matched: false, bestConfidence: 0, reason: "no_candidates_in_time_window" };
    }

    const scored: ScoredCandidate[] = [];

    for (const candidate of candidatesInWindow) {
      const candidateMs = Date.parse(candidate.dateStart);
      const timeScore = computeTimeScore(fixtureMs, candidateMs, windowMinutes);

      const [homeDirect, awayDirect, homeReversed, awayReversed] = await Promise.all([
        scoreTeam({
          source: input.source,
          sportId: input.sportId,
          apifootballTeamId: input.fixture.home.id,
          apifootballName: input.fixture.home.name,
          externalName: candidate.home,
          aliasRepo: this.aliasRepo,
        }),
        scoreTeam({
          source: input.source,
          sportId: input.sportId,
          apifootballTeamId: input.fixture.away.id,
          apifootballName: input.fixture.away.name,
          externalName: candidate.away,
          aliasRepo: this.aliasRepo,
        }),
        scoreTeam({
          source: input.source,
          sportId: input.sportId,
          apifootballTeamId: input.fixture.home.id,
          apifootballName: input.fixture.home.name,
          externalName: candidate.away,
          aliasRepo: this.aliasRepo,
        }),
        scoreTeam({
          source: input.source,
          sportId: input.sportId,
          apifootballTeamId: input.fixture.away.id,
          apifootballName: input.fixture.away.name,
          externalName: candidate.home,
          aliasRepo: this.aliasRepo,
        }),
      ]);

      const directTotal = combineScores(timeScore, homeDirect.score, awayDirect.score);
      const reversedTotal =
        combineScores(timeScore, homeReversed.score, awayReversed.score) - reversePenalty;

      if (directTotal >= reversedTotal) {
        scored.push({
          candidate,
          total: directTotal,
          timeScore,
          homeScore: homeDirect.score,
          awayScore: awayDirect.score,
          matchedBy: pickStrongerMatchedBy(homeDirect.matchedBy, awayDirect.matchedBy),
          reversed: false,
        });
      } else {
        scored.push({
          candidate,
          total: reversedTotal,
          timeScore,
          homeScore: homeReversed.score,
          awayScore: awayReversed.score,
          matchedBy: pickStrongerMatchedBy(homeReversed.matchedBy, awayReversed.matchedBy),
          reversed: true,
        });
      }
    }

    scored.sort((left, right) => right.total - left.total);
    const best = scored[0]!;

    if (best.total < acceptThreshold) {
      return {
        matched: false,
        bestCandidateId: best.candidate.externalEventId,
        bestConfidence: best.total,
        reason: "below_threshold",
      };
    }

    return {
      matched: true,
      externalEventId: best.candidate.externalEventId,
      confidence: best.total,
      matchedBy: best.matchedBy,
      timeScore: best.timeScore,
      homeScore: best.homeScore,
      awayScore: best.awayScore,
      reversed: best.reversed,
    };
  }
}

export const eventMatcherService = new EventMatcherService();
