import { logInfo } from "../../../shared/logging/logger";
import { footballService } from "../../sports/application/football.service";
import type { ApiFootballFixtureItem } from "../../sports/domain/football.types";
import { getAllTeamsOnlyByMinId } from "../../stats/application/stats.service";
import { openai } from "../infrastructure/openai.client";
import {
  buildDailyInsightsCacheKey,
  buildInsightsLockKey,
  buildMatchInsightsCacheKey,
} from "../infrastructure/insights-cache-key";
import {
  getDailyInsightsTtlSeconds,
  getMatchStreaksTtlSeconds,
  getMatchSummaryTtlSeconds,
  resolveMatchState,
} from "../infrastructure/insights-cache-ttl.policy";
import { redisInsightsCacheStore } from "../infrastructure/insights-cache.store";

const COMPLETED_MATCH_STATUS = new Set(["FT", "AET", "PEN"]);
const LOCK_TTL_SECONDS = 25;
const LOCK_MAX_RETRIES = 10;
const LOCK_WAIT_MS = 180;

type MatchStreakResult = "W" | "D" | "L";

type MatchStreaksTeamSnapshot = {
  teamId: number;
  teamName: string;
  teamLogo: string | null;
  sampleSize: number;
  form: string;
  goalsForTotal: number;
  goalsAgainstTotal: number;
  goalsForPg: number | null;
  goalsAgainstPg: number | null;
  totalGoalsPg: number | null;
  over25Pct: number | null;
  bttsPct: number | null;
  cleanSheets: number;
  failedToScore: number;
  currentRun: {
    wins: number;
    draws: number;
    losses: number;
    unbeaten: number;
    scoring: number;
    conceding: number;
  };
  dbContext?: {
    pointsPg: number | null;
    winPercentage: number | null;
  };
};

export type MatchStreaksResponse = {
  fixtureId: number;
  home: MatchStreaksTeamSnapshot;
  away: MatchStreaksTeamSnapshot;
  interestingFacts: string[];
  meta: {
    computedAt: string;
    source: "hybrid";
    ttlSeconds: number;
    cacheHit: boolean;
  };
};

type TeamDbContext = {
  pointsPg: number | null;
  winPercentage: number | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFixtureKickoffDate(fixture: ApiFootballFixtureItem) {
  return fixture.fixture?.date ?? null;
}

function getFixtureTimestampMs(fixture: ApiFootballFixtureItem) {
  const ts = fixture.fixture?.timestamp;
  if (typeof ts === "number" && Number.isFinite(ts)) {
    return ts * 1000;
  }

  const date = fixture.fixture?.date ? new Date(fixture.fixture.date) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}

function isCompletedFixture(fixture: ApiFootballFixtureItem) {
  const short = fixture.fixture?.status?.short?.toUpperCase() ?? "";
  if (!COMPLETED_MATCH_STATUS.has(short)) return false;
  return fixture.goals?.home !== null && fixture.goals?.away !== null;
}

function toPercent(part: number, total: number) {
  if (total <= 0) return null;
  return (part / total) * 100;
}

function toPerGame(total: number, games: number) {
  if (games <= 0) return null;
  return total / games;
}

function toMetric(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) return "-";
  return value
    .toFixed(digits)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*[1-9])0+$/, "$1");
}

function toResultRow(fixture: ApiFootballFixtureItem, teamId: number) {
  const isHome = fixture.teams.home.id === teamId;
  const goalsFor = isHome ? fixture.goals.home ?? 0 : fixture.goals.away ?? 0;
  const goalsAgainst = isHome ? fixture.goals.away ?? 0 : fixture.goals.home ?? 0;

  let result: MatchStreakResult = "D";
  if (goalsFor > goalsAgainst) result = "W";
  else if (goalsFor < goalsAgainst) result = "L";

  return { goalsFor, goalsAgainst, result };
}

function buildCurrentRun(
  results: Array<{ goalsFor: number; goalsAgainst: number; result: MatchStreakResult }>
) {
  const countWhile = (
    predicate: (row: {
      goalsFor: number;
      goalsAgainst: number;
      result: MatchStreakResult;
    }) => boolean
  ) => {
    let count = 0;
    for (const row of results) {
      if (!predicate(row)) break;
      count += 1;
    }
    return count;
  };

  return {
    wins: countWhile((row) => row.result === "W"),
    draws: countWhile((row) => row.result === "D"),
    losses: countWhile((row) => row.result === "L"),
    unbeaten: countWhile((row) => row.result !== "L"),
    scoring: countWhile((row) => row.goalsFor > 0),
    conceding: countWhile((row) => row.goalsAgainst > 0),
  };
}

function buildTeamStreakSnapshot(input: {
  teamId: number;
  teamName: string;
  teamLogo: string | null;
  fixtures: ApiFootballFixtureItem[];
  dbContext?: TeamDbContext | null;
}): MatchStreaksTeamSnapshot {
  const ordered = [...input.fixtures]
    .filter(isCompletedFixture)
    .sort((a, b) => getFixtureTimestampMs(b) - getFixtureTimestampMs(a))
    .slice(0, 10);

  const resultRows = ordered.map((fixture) => toResultRow(fixture, input.teamId));
  const sampleSize = resultRows.length;
  const goalsForTotal = resultRows.reduce((acc, row) => acc + row.goalsFor, 0);
  const goalsAgainstTotal = resultRows.reduce((acc, row) => acc + row.goalsAgainst, 0);
  const over25Count = resultRows.filter((row) => row.goalsFor + row.goalsAgainst > 2).length;
  const bttsCount = resultRows.filter((row) => row.goalsFor > 0 && row.goalsAgainst > 0).length;
  const cleanSheets = resultRows.filter((row) => row.goalsAgainst === 0).length;
  const failedToScore = resultRows.filter((row) => row.goalsFor === 0).length;
  const form = resultRows
    .slice(0, 5)
    .map((row) => row.result)
    .join("");

  return {
    teamId: input.teamId,
    teamName: input.teamName,
    teamLogo: input.teamLogo,
    sampleSize,
    form,
    goalsForTotal,
    goalsAgainstTotal,
    goalsForPg: toPerGame(goalsForTotal, sampleSize),
    goalsAgainstPg: toPerGame(goalsAgainstTotal, sampleSize),
    totalGoalsPg: toPerGame(goalsForTotal + goalsAgainstTotal, sampleSize),
    over25Pct: toPercent(over25Count, sampleSize),
    bttsPct: toPercent(bttsCount, sampleSize),
    cleanSheets,
    failedToScore,
    currentRun: buildCurrentRun(resultRows),
    dbContext: input.dbContext
      ? {
          pointsPg: input.dbContext.pointsPg,
          winPercentage: input.dbContext.winPercentage,
        }
      : undefined,
  };
}

function buildInterestingFacts(input: {
  home: MatchStreaksTeamSnapshot;
  away: MatchStreaksTeamSnapshot;
}) {
  const facts: string[] = [];
  const { home, away } = input;

  facts.push(
    `${home.teamName} marcó ${home.goalsForTotal} goles en sus últimos ${home.sampleSize} partidos (${toMetric(home.goalsForPg)} por juego).`
  );
  facts.push(
    `${away.teamName} recibió ${away.goalsAgainstTotal} goles en sus últimos ${away.sampleSize} partidos (${toMetric(away.goalsAgainstPg)} por juego).`
  );

  if (home.over25Pct !== null && away.over25Pct !== null) {
    facts.push(
      `La tendencia de +2.5 goles llega alta: ${home.teamName} ${toMetric(home.over25Pct, 0)}% y ${away.teamName} ${toMetric(away.over25Pct, 0)}%.`
    );
  }

  if (home.currentRun.unbeaten >= 3) {
    facts.push(
      `${home.teamName} llega con ${home.currentRun.unbeaten} partidos seguidos sin perder.`
    );
  }

  if (away.currentRun.unbeaten >= 3) {
    facts.push(
      `${away.teamName} llega con ${away.currentRun.unbeaten} partidos seguidos sin perder.`
    );
  }

  if (home.dbContext?.pointsPg !== null && home.dbContext?.pointsPg !== undefined) {
    facts.push(
      `${home.teamName} promedia ${toMetric(home.dbContext.pointsPg)} puntos por partido en su liga.`
    );
  }

  if (away.dbContext?.winPercentage !== null && away.dbContext?.winPercentage !== undefined) {
    facts.push(
      `${away.teamName} tiene ${toMetric(away.dbContext.winPercentage, 0)}% de victorias en su liga.`
    );
  }

  return facts.slice(0, 7);
}

async function loadTeamDbContext(
  minId: number,
  leagueMinId: number
): Promise<TeamDbContext | null> {
  try {
    const response = (await getAllTeamsOnlyByMinId(minId, {
      entityType: "team",
    })) as unknown;
    const data = (response as { data?: unknown })?.data;
    if (!data || typeof data !== "object") return null;
    if ((data as { type?: string }).type !== "team") return null;

    const performance = (
      data as { performance?: { all?: Array<Record<string, unknown>> } }
    ).performance?.all;
    if (!Array.isArray(performance)) return null;

    const primary =
      performance.find(
        (row) =>
          Number(row?.viewTypeId) === 1 &&
          Number((row?.Tournament as { minId?: number })?.minId) === leagueMinId
      ) ??
      performance.find((row) => Number(row?.viewTypeId) === 1) ??
      null;

    if (!primary) return null;

    const pointsPg = Number(primary.pointsPg);
    const winPercentage = Number(primary.winPercentage);

    return {
      pointsPg: Number.isFinite(pointsPg) ? pointsPg : null,
      winPercentage: Number.isFinite(winPercentage) ? winPercentage : null,
    };
  } catch {
    return null;
  }
}

export class InsightsService {
  private async getFixtureById(fixtureId: number) {
    const fixturesRes = await footballService.getFixtures({ id: fixtureId });
    return fixturesRes.response[0] ?? null;
  }

  private async getOrComputeCachedValue<T>(params: {
    cacheKey: string;
    ttlSeconds: number;
    compute: () => Promise<T>;
  }) {
    const { cacheKey, ttlSeconds, compute } = params;
    const cached = await redisInsightsCacheStore.get<T>(cacheKey);
    if (cached !== null) {
      return { value: cached, cacheHit: true };
    }

    const lockKey = buildInsightsLockKey(cacheKey);
    const lockAcquired = await redisInsightsCacheStore.setNx(
      lockKey,
      "1",
      LOCK_TTL_SECONDS
    );

    if (lockAcquired) {
      try {
        const computed = await compute();
        await redisInsightsCacheStore.set(cacheKey, computed, ttlSeconds);
        return { value: computed, cacheHit: false };
      } finally {
        await redisInsightsCacheStore.del(lockKey);
      }
    }

    for (let retry = 0; retry < LOCK_MAX_RETRIES; retry++) {
      await sleep(LOCK_WAIT_MS);
      const fromCache = await redisInsightsCacheStore.get<T>(cacheKey);
      if (fromCache !== null) {
        return { value: fromCache, cacheHit: true };
      }
    }

    const computed = await compute();
    await redisInsightsCacheStore.set(cacheKey, computed, ttlSeconds);
    return { value: computed, cacheHit: false };
  }

  async getMatchStreaks(fixtureId: number): Promise<MatchStreaksResponse> {
    const fixtureData = await this.getFixtureById(fixtureId);
    if (!fixtureData) {
      throw new Error("Partido no encontrado");
    }

    const state = resolveMatchState({
      statusShort: fixtureData.fixture.status.short,
      kickoffAt: getFixtureKickoffDate(fixtureData),
    });
    const ttlSeconds = getMatchStreaksTtlSeconds(state);
    const cacheKey = buildMatchInsightsCacheKey("match_streaks", fixtureId);

    const result = await this.getOrComputeCachedValue<MatchStreaksResponse>({
      cacheKey,
      ttlSeconds,
      compute: async () => {
        const homeTeam = fixtureData.teams.home;
        const awayTeam = fixtureData.teams.away;

        const [homeFixturesRes, awayFixturesRes, homeDbContext, awayDbContext] =
          await Promise.all([
            footballService.getFixtures({ team: homeTeam.id, last: 10 }),
            footballService.getFixtures({ team: awayTeam.id, last: 10 }),
            loadTeamDbContext(homeTeam.id, fixtureData.league.id),
            loadTeamDbContext(awayTeam.id, fixtureData.league.id),
          ]);

        const home = buildTeamStreakSnapshot({
          teamId: homeTeam.id,
          teamName: homeTeam.name,
          teamLogo: homeTeam.logo ?? null,
          fixtures: homeFixturesRes.response ?? [],
          dbContext: homeDbContext,
        });

        const away = buildTeamStreakSnapshot({
          teamId: awayTeam.id,
          teamName: awayTeam.name,
          teamLogo: awayTeam.logo ?? null,
          fixtures: awayFixturesRes.response ?? [],
          dbContext: awayDbContext,
        });

        return {
          fixtureId,
          home,
          away,
          interestingFacts: buildInterestingFacts({ home, away }),
          meta: {
            computedAt: new Date().toISOString(),
            source: "hybrid",
            ttlSeconds,
            cacheHit: false,
          },
        };
      },
    });

    if (result.cacheHit) {
      logInfo("insights.match_streaks.cache_hit", {
        fixtureId,
        cacheKey,
        ttlSeconds,
      });
    }

    return {
      ...result.value,
      meta: {
        ...result.value.meta,
        cacheHit: result.cacheHit,
        ttlSeconds,
      },
    };
  }

  /**
   * Generates a narrator-style summary for a given fixture ID.
   */
  async generateMatchSummary(fixtureId: number): Promise<string> {
    const fixtureData = await this.getFixtureById(fixtureId);
    if (!fixtureData) {
      throw new Error("Partido no encontrado");
    }

    const state = resolveMatchState({
      statusShort: fixtureData.fixture.status.short,
      kickoffAt: getFixtureKickoffDate(fixtureData),
    });
    const ttlSeconds = getMatchSummaryTtlSeconds(state);
    const cacheKey = buildMatchInsightsCacheKey("match_summary", fixtureId);

    const result = await this.getOrComputeCachedValue<string>({
      cacheKey,
      ttlSeconds,
      compute: async () => {
        const [statsRes, eventsRes] = await Promise.all([
          footballService.getFixtureStatistics({ fixture: fixtureId }),
          footballService.getFixtureEvents({ fixture: fixtureId }),
        ]);

        const { fixture, league, teams, goals, score } = fixtureData;
        const statistics = statsRes.response || [];
        const events = eventsRes.response || [];

        const matchContext = {
          tournament: league.name,
          round: league.round,
          homeTeam: teams.home.name,
          awayTeam: teams.away.name,
          finalScore: `${goals.home} - ${goals.away}`,
          halftimeScore: `${score.halftime.home} - ${score.halftime.away}`,
          status: fixture.status.long,
          events: events.map((e) => ({
            time: `${e.time.elapsed}${e.time.extra ? "+" + e.time.extra : ""}'`,
            team: e.team.name,
            player: e.player.name,
            assist: e.assist.name,
            type: e.type,
            detail: e.detail,
          })),
          keyStats: statistics.map((s) => ({
            team: s.team.name,
            stats: s.statistics.filter((st) =>
              ["Ball Possession", "Total Shots", "Shots on Goal", "Fouls"].includes(
                st.type
              )
            ),
          })),
        };

        const systemPrompt = `Eres un relator y analista experto de fútbol sudamericano e internacional.
Tu tarea es narrar un resumen breve pero sustancioso del partido basándote en los datos estadísticos y los eventos (goles, tarjetas, cambios).
Debes transmitir cómo se sintió el partido: si fue dominado de principio a fin, si fue un encuentro tenso, si hubo un giro dramático, etc.
Escribe en un tono atrapante, vibrante y muy profesional.
Evita el abuso de números o porcentajes; menciona solo los que sean estrictamente necesarios para respaldar la narrativa (por ejemplo, posesión abrumadora o cantidad de tiros).
Formato de salida: Devuelve directamente el texto, sin introducciones conversacionales. Puede tener un pequeño título creativo al comienzo en Markdown (ej: ### El dominio táctico de X sobre Y).`;

        const completion = await openai.responses.create({
          model: "gpt-5-mini",
          reasoning: { effort: "low" },
          instructions: systemPrompt,
          input: `Aquí tienes los datos del partido:\n\n${JSON.stringify(
            matchContext,
            null,
            2
          )}`,
        });

        return completion.output_text || "No se pudo generar el resumen del partido.";
      },
    });

    if (result.cacheHit) {
      logInfo("insights.match_summary.cache_hit", {
        fixtureId,
        cacheKey,
        ttlSeconds,
      });
    }

    return result.value;
  }

  /**
   * Generates Daily Insights recommending featured matches from a given date.
   */
  async generateDailyInsights(date: string): Promise<string> {
    const ttlSeconds = getDailyInsightsTtlSeconds(date);
    const cacheKey = buildDailyInsightsCacheKey(date);

    const result = await this.getOrComputeCachedValue<string>({
      cacheKey,
      ttlSeconds,
      compute: async () => {
        const fixturesRes = await footballService.getFixtures({ date });
        const finishedFixtures = fixturesRes.response.filter(
          (f) =>
            f.fixture.status.short === "FT" ||
            f.fixture.status.short === "PEN" ||
            f.fixture.status.short === "AET"
        );

        const topFixtures = finishedFixtures
          .sort(
            (a, b) =>
              (b.goals.home ?? 0) +
              (b.goals.away ?? 0) -
              ((a.goals.home ?? 0) + (a.goals.away ?? 0))
          )
          .slice(0, 15)
          .map((f) => ({
            id: f.fixture.id,
            league: f.league.name,
            homeTeam: f.teams.home.name,
            awayTeam: f.teams.away.name,
            score: `${f.goals.home} - ${f.goals.away}`,
          }));

        if (topFixtures.length === 0) {
          return "No hay partidos finalizados destacables para esta fecha.";
        }

        const systemPrompt = `Eres un analista experto de fútbol global.
Tu tarea es revisar un listado de resultados de partidos de fútbol disputados en un día específico y generar una sección de "Insights del Día" o "Partidos Destacados".
Tu objetivo es recomendar cuáles fueron los encuentros más memorables o sorpresivos del día. No tienes que mencionar todos los partidos, selecciona los 3 o 4 mejores.
Usa un tono profesional, editorial y analítico.
Formato:
### Insights del Día
- **[Partido 1]**: Breve análisis de por qué destacó.
- **[Partido 2]**: Breve análisis de por qué destacó.
(No inventes datos que no estén en el input, básate en el marcador final).`;

        const completion = await openai.responses.create({
          model: "gpt-5-mini",
          reasoning: { effort: "low" },
          instructions: systemPrompt,
          input: `Partidos de la fecha ${date}:\n\n${JSON.stringify(
            topFixtures,
            null,
            2
          )}`,
        });

        return completion.output_text || "No se pudo generar los insights del día.";
      },
    });

    if (result.cacheHit) {
      logInfo("insights.daily.cache_hit", { date, cacheKey, ttlSeconds });
    }

    return result.value;
  }
}

export const insightsService = new InsightsService();

