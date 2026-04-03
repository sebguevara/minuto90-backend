import { logInfo } from "../../../shared/logging/logger";
import { footballService } from "../../sports/application/football.service";
import type { ApiFootballFixtureItem } from "../../sports/domain/football.types";
import {
  getAllTeamsOnlyByMinId,
  getTeamMatchProfile,
} from "../../stats/application/stats.service";
import { openai } from "../infrastructure/openai.client";
import {
  buildDailyInsightsCacheKey,
  buildFeaturedMatchesCacheKey,
  buildInsightsLockKey,
  buildMatchInsightsCacheKey,
} from "../infrastructure/insights-cache-key";
import {
  getDailyInsightsTtlSeconds,
  getFeaturedMatchesTtlSeconds,
  getMatchStreaksTtlSeconds,
  getMatchSummaryTtlSeconds,
  resolveMatchState,
} from "../infrastructure/insights-cache-ttl.policy";
import { redisInsightsCacheStore } from "../infrastructure/insights-cache.store";

const COMPLETED_MATCH_STATUS = new Set(["FT", "AET", "PEN"]);
const LIVE_MATCH_STATUS = new Set([
  "1H", "2H", "ET", "P", "BT", "LIVE", "INT", "HT", "SUSP", "INTR",
]);
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

async function withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 600): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      await sleep(delayMs);
    }
  }
  throw new Error("unreachable");
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

type TeamWhoScoredProfile = {
  strengths: string[];
  weaknesses: string[];
  styleOfPlay: string[];
  topStats: {
    rating: number | null;
    possession: number | null;
    shotsPg: number | null;
    passSuccess: number | null;
    goals: number | null;
    apps: number | null;
  };
};

async function loadTeamWhoScoredProfile(
  teamMinId: number,
  leagueId: number
): Promise<TeamWhoScoredProfile | null> {
  try {
    const result = await getTeamMatchProfile(teamMinId);
    const profile = result?.data;
    if (!profile) return null;

    const strengths = (profile.characteristics ?? [])
      .filter((c: { kind: string }) => c.kind === "strength")
      .map((c: { label: string }) => c.label);

    const weaknesses = (profile.characteristics ?? [])
      .filter((c: { kind: string }) => c.kind === "weakness")
      .map((c: { label: string }) => c.label);

    const styleOfPlay = (profile.styleOfPlay ?? []).map(
      (s: { label: string }) => s.label
    );

    // Pick overall summary row, prefer matching league
    const summaryRows = profile.topStats?.summary ?? [];
    const summaryRow =
      summaryRows.find(
        (r: { viewTypeId: number; tournamentId: number }) =>
          r.viewTypeId === 1 && r.tournamentId === leagueId
      ) ??
      summaryRows.find(
        (r: { viewTypeId: number }) => r.viewTypeId === 1
      ) ??
      null;

    return {
      strengths: strengths.slice(0, 5),
      weaknesses: weaknesses.slice(0, 5),
      styleOfPlay: styleOfPlay.slice(0, 6),
      topStats: {
        rating: summaryRow?.rating ?? null,
        possession: summaryRow?.possession ?? null,
        shotsPg: summaryRow?.shotsPg ?? null,
        passSuccess: summaryRow?.passSuccess ?? null,
        goals: summaryRow?.goals ?? null,
        apps: summaryRow?.apps ?? null,
      },
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

    const statusShort = fixtureData.fixture.status.short?.toUpperCase() ?? "";
    const isFinished = COMPLETED_MATCH_STATUS.has(statusShort);
    const isLive = LIVE_MATCH_STATUS.has(statusShort);

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
        if (isFinished) {
          return this.computePostMatchSummary(fixtureId, fixtureData);
        }
        if (isLive) {
          return this.computeLiveMatchAnalysis(fixtureId, fixtureData);
        }
        return this.computePreMatchAnalysis(fixtureId, fixtureData);
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

  private async computePostMatchSummary(
    fixtureId: number,
    fixtureData: ApiFootballFixtureItem
  ): Promise<string> {
    const [statsRes, eventsRes, lineupsRes, playersRes] = await Promise.all([
      footballService.getFixtureStatistics({ fixture: fixtureId }),
      footballService.getFixtureEvents({ fixture: fixtureId }),
      footballService.getFixtureLineups({ fixture: fixtureId }),
      footballService.getFixturePlayers({ fixture: fixtureId }),
    ]);

    const { league, teams, goals, score } = fixtureData;
    const statistics = statsRes.response || [];
    const events = eventsRes.response || [];
    const lineups = lineupsRes.response || [];
    const playersData = playersRes.response || [];

    const topPlayers = playersData.flatMap((t) =>
      t.players
        .filter((p) => p.statistics?.[0]?.games?.rating)
        .sort(
          (a, b) =>
            parseFloat(b.statistics[0].games.rating ?? "0") -
            parseFloat(a.statistics[0].games.rating ?? "0")
        )
        .slice(0, 5)
        .map((p) => {
          const s = p.statistics[0];
          return {
            name: p.player.name,
            team: t.team.name,
            rating: s.games.rating,
            goals: s.goals?.total ?? 0,
            assists: s.goals?.assists ?? 0,
            shots: s.shots?.total ?? 0,
            shotsOnTarget: s.shots?.on ?? 0,
            keyPasses: s.passes?.key ?? 0,
            passAccuracy: s.passes?.accuracy,
            duelsWon: s.duels?.won ?? 0,
            duelsTotal: s.duels?.total ?? 0,
            tackles: s.tackles?.total ?? 0,
            interceptions: s.tackles?.interceptions ?? 0,
          };
        })
    );

    const matchContext = {
      tournament: league.name,
      round: league.round,
      homeTeam: teams.home.name,
      awayTeam: teams.away.name,
      finalScore: `${goals.home} - ${goals.away}`,
      halftimeScore: `${score.halftime.home} - ${score.halftime.away}`,
      events: events.map((e) => ({
        time: `${e.time.elapsed}${e.time.extra ? "+" + e.time.extra : ""}'`,
        team: e.team.name,
        player: e.player.name,
        assist: e.assist.name,
        type: e.type,
        detail: e.detail,
      })),
      statistics: statistics.map((s) => ({
        team: s.team.name,
        stats: s.statistics,
      })),
      lineups: lineups.map((l) => ({
        team: l.team.name,
        formation: l.formation,
        startXI: l.startXI.map((p) => p.player.name),
        coach: l.coach?.name ?? null,
      })),
      topPlayers,
    };

    const systemPrompt = `Eres un analista deportivo de élite especializado en fútbol. Tu audiencia son aficionados exigentes que buscan análisis profundo, no un resumen genérico.

ESTRUCTURA (2 párrafos máximo):
1. Resultado, narrativa y análisis táctico — quién dominó, formaciones, qué funcionó y qué no. Menciona contexto del torneo y respalda con estadísticas clave (posesión, tiros, pases). Si hubo giro dramático, destácalo.
2. Figuras y conclusión — jugadores destacados con datos concretos (rating, goles, asistencias, pases clave, duelos). Cierra con qué se lleva cada equipo y lectura para el torneo.

REGLAS:
- Idioma: español.
- Tono: profesional, analítico, directo. Sin clichés vacíos.
- Sé conciso. Cada frase debe aportar información nueva.
- Usa datos solo cuando aporten valor real a la narrativa.
- NO inventes datos que no estén en el input.
- Devuelve directamente el texto sin encabezados markdown, sin emojis, sin introducciones conversacionales.`;

    const completion = await withRetry(() =>
      openai.responses.create({
        model: "gpt-5-mini",
        reasoning: { effort: "low" },
        instructions: systemPrompt,
        input: `Datos del partido:\n\n${JSON.stringify(matchContext, null, 2)}`,
      })
    );

    return completion.output_text || "No se pudo generar el resumen del partido.";
  }

  private async computePreMatchAnalysis(
    fixtureId: number,
    fixtureData: ApiFootballFixtureItem
  ): Promise<string> {
    const { league, teams } = fixtureData;
    const homeId = teams.home.id;
    const awayId = teams.away.id;

    const [
      predictionsRes,
      standingsRes,
      h2hRes,
      oddsRes,
      lineupsRes,
      homeWsProfile,
      awayWsProfile,
    ] = await Promise.all([
      footballService
        .getPredictions({ fixture: fixtureId })
        .catch(() => ({ response: [] })),
      footballService
        .getStandings({ league: league.id, season: league.season })
        .catch(() => ({ response: [] })),
      footballService
        .getFixtureHeadToHead({ h2h: `${homeId}-${awayId}`, last: 5 })
        .catch(() => ({ response: [] })),
      footballService
        .getOdds({ fixture: fixtureId })
        .catch(() => ({ response: [] })),
      footballService
        .getFixtureLineups({ fixture: fixtureId })
        .catch(() => ({ response: [] })),
      loadTeamWhoScoredProfile(homeId, league.id),
      loadTeamWhoScoredProfile(awayId, league.id),
    ]);

    const prediction = predictionsRes.response?.[0] ?? null;
    const standings = standingsRes.response?.[0]?.league?.standings?.[0] ?? [];
    const h2hFixtures = h2hRes.response || [];
    const lineups = lineupsRes.response || [];

    const homeStanding = Array.isArray(standings)
      ? standings.find((s: { team?: { id?: number } }) => s.team?.id === homeId)
      : null;
    const awayStanding = Array.isArray(standings)
      ? standings.find((s: { team?: { id?: number } }) => s.team?.id === awayId)
      : null;

    const formatStanding = (s: Record<string, unknown> | null | undefined) => {
      if (!s) return null;
      return {
        position: s.rank,
        points: s.points,
        form: s.form,
        record: s.all,
        description: s.description,
      };
    };

    // Extract 1X2 odds from 1xBet only
    const oddsData = oddsRes.response?.[0] ?? null;
    const oneXBetBookmaker = oddsData?.bookmakers?.find(
      (bk) => bk.name.toLowerCase().includes("1xbet")
    );
    const matchWinnerBet = oneXBetBookmaker?.bets
      ?.filter((b) => b.name === "Match Winner")
      .map((b) => ({
        values: b.values.reduce(
          (acc, v) => {
            const label = String(v.value);
            if (label === "Home") acc.home = v.odd;
            else if (label === "Draw") acc.draw = v.odd;
            else if (label === "Away") acc.away = v.odd;
            return acc;
          },
          {} as { home?: string; draw?: string; away?: string }
        ),
      }))?.[0] ?? null;

    let resolvedPercent = prediction?.predictions?.percent ?? null;
    if (matchWinnerBet?.values.home && matchWinnerBet?.values.draw && matchWinnerBet?.values.away) {
      const h = 1 / parseFloat(matchWinnerBet.values.home);
      const d = 1 / parseFloat(matchWinnerBet.values.draw);
      const a = 1 / parseFloat(matchWinnerBet.values.away);
      const t = h + d + a;
      resolvedPercent = {
        home: `${Math.round((h / t) * 100)}%`,
        draw: `${Math.round((d / t) * 100)}%`,
        away: `${Math.round((a / t) * 100)}%`,
      };
    }

    const preMatchContext = {
      tournament: league.name,
      round: league.round,
      date: fixtureData.fixture.date,
      homeTeam: teams.home.name,
      awayTeam: teams.away.name,
      standings: {
        home: formatStanding(homeStanding as Record<string, unknown> | null),
        away: formatStanding(awayStanding as Record<string, unknown> | null),
      },
      h2h: h2hFixtures.map((f) => ({
        date: f.fixture.date,
        homeTeam: f.teams.home.name,
        awayTeam: f.teams.away.name,
        score: `${f.goals.home} - ${f.goals.away}`,
        league: f.league.name,
      })),
      prediction: prediction
        ? {
            winner: prediction.predictions?.winner?.name ?? null,
            winOrDraw: prediction.predictions?.win_or_draw ?? null,
            advice: prediction.predictions?.advice ?? null,
            percent: resolvedPercent,
            underOver: prediction.predictions?.under_over ?? null,
          }
        : null,
      comparison: prediction?.comparison ?? null,
      odds: matchWinnerBet
        ? {
            bookmaker: "1xBet",
            home: matchWinnerBet.values.home ?? null,
            draw: matchWinnerBet.values.draw ?? null,
            away: matchWinnerBet.values.away ?? null,
          }
        : null,
      homeFormLast5: prediction?.teams?.home?.last_5 ?? null,
      awayFormLast5: prediction?.teams?.away?.last_5 ?? null,
      lineups:
        lineups.length > 0
          ? lineups.map((l) => ({
              team: l.team.name,
              formation: l.formation,
              coach: l.coach?.name ?? null,
              startXI: l.startXI.map((p) => ({
                name: p.player.name,
                pos: p.player.pos,
                number: p.player.number,
              })),
            }))
          : null,
    };

    const hasLineups = lineups.length > 0;

    const systemPrompt = `Eres un analista deportivo de élite especializado en fútbol. Genera un análisis previo COMPACTO del partido.

ESTRUCTURA (2 párrafos máximo, cortos y directos):
1. Contexto y claves — posiciones en la tabla (qué se juega cada equipo: título, clasificación, descenso, nada), forma reciente, historial directo.${hasLineups ? " Si hay alineaciones, analiza las formaciones (ej: 4-3-3 agresivo vs 5-4-1 defensivo), jugadores clave y qué plantea tácticamente cada técnico." : ""}
2. Cuotas y pronóstico — si el campo "odds" en los datos NO es null, analiza las cuotas exactas de 1xBet (menciónalas: "1xBet paga X al local, Y al empate y Z a la visita") y qué refleja el mercado. Si "odds" ES null, basa el pronóstico en la comparación de forma, historial directo y posición en tabla. Cierra con un pronóstico razonado. No seas absoluto, presenta matices.

DATOS CLAVE:
- "standings": posición y puntos en la tabla. "description" indica si pelea por algo (Champions, descenso, etc).
- "homeFormLast5"/"awayFormLast5": forma reciente. "form" es % de rendimiento (100% = todas victorias). "goals" tiene goles a favor/contra en últimos 5.
- "comparison": comparación porcentual forma/ataque/defensa entre equipos.
- "odds": cuotas de 1xBet (puede ser null si no están disponibles). Cuota más baja = mayor favoritismo.${hasLineups ? '\n- "lineups": alineaciones confirmadas. "pos" indica posición (G=portero, D=defensa, M=mediocampista, F=delantero). La formación revela la intención táctica del DT.' : ""}

REGLAS:
- Idioma: español. Tono: profesional y conciso.
- Máximo 5-6 oraciones por párrafo.
- Cuando menciones forma, traduce el porcentaje a contexto (ej: "80%" = "4 de 5 positivos").
- Si "odds" es null, NUNCA menciones la ausencia de cuotas. Simplemente omite ese dato y sustituye por análisis basado en los demás datos.
- Cuando haya cuotas, siempre menciona "1xBet" por nombre.
- NO inventes datos. Sin markdown, sin emojis, sin introducciones.`;

    const completion = await withRetry(() =>
      openai.responses.create({
        model: "gpt-5-mini",
        reasoning: { effort: "low" },
        instructions: systemPrompt,
        input: `Datos previos al partido:\n\n${JSON.stringify(preMatchContext, null, 2)}`,
      })
    );

    return completion.output_text || "No se pudo generar el análisis previo.";
  }

  private async computeLiveMatchAnalysis(
    fixtureId: number,
    fixtureData: ApiFootballFixtureItem
  ): Promise<string> {
    const { league, teams, goals } = fixtureData;
    const elapsed = fixtureData.fixture.status.elapsed ?? null;
    const statusLong = fixtureData.fixture.status.long ?? "";

    const [statsRes, eventsRes, lineupsRes, liveOddsRes] = await Promise.all([
      footballService
        .getFixtureStatistics({ fixture: fixtureId })
        .catch(() => ({ response: [] })),
      footballService
        .getFixtureEvents({ fixture: fixtureId })
        .catch(() => ({ response: [] })),
      footballService
        .getFixtureLineups({ fixture: fixtureId })
        .catch(() => ({ response: [] })),
      footballService
        .getOddsLive({ fixture: fixtureId })
        .catch(() => ({ response: [] })),
    ]);

    const statistics = statsRes.response || [];
    const events = eventsRes.response || [];
    const lineups = lineupsRes.response || [];
    const liveOdds = liveOddsRes.response?.[0] ?? null;

    // Extract 1xBet live odds
    const oneXBetLiveOdds = liveOdds?.odds
      ?.find((b) => b.name === "Match Winner")
      ?.values?.reduce(
        (acc, v) => {
          const label = String(v.value);
          if (label === "Home") acc.home = v.odd;
          else if (label === "Draw") acc.draw = v.odd;
          else if (label === "Away") acc.away = v.odd;
          return acc;
        },
        {} as { home?: string; draw?: string; away?: string }
      ) ?? null;

    const liveContext = {
      tournament: league.name,
      round: league.round,
      homeTeam: teams.home.name,
      awayTeam: teams.away.name,
      score: `${goals.home ?? 0} - ${goals.away ?? 0}`,
      elapsed,
      status: statusLong,
      events: events.map((e) => ({
        time: `${e.time.elapsed}${e.time.extra ? "+" + e.time.extra : ""}'`,
        team: e.team.name,
        player: e.player.name,
        assist: e.assist.name,
        type: e.type,
        detail: e.detail,
      })),
      statistics: statistics.map((s) => ({
        team: s.team.name,
        stats: s.statistics,
      })),
      lineups: lineups.map((l) => ({
        team: l.team.name,
        formation: l.formation,
        coach: l.coach?.name ?? null,
        startXI: l.startXI.map((p) => ({
          name: p.player.name,
          pos: p.player.pos,
        })),
      })),
      liveOdds: oneXBetLiveOdds
        ? {
            bookmaker: "1xBet",
            home: oneXBetLiveOdds.home ?? null,
            draw: oneXBetLiveOdds.draw ?? null,
            away: oneXBetLiveOdds.away ?? null,
          }
        : null,
    };

    const systemPrompt = `Eres un analista deportivo en VIVO comentando un partido que está en juego AHORA MISMO. Tu tono es el de un analista de transmisión en directo: presente, preciso y con urgencia.

CONTEXTO: El partido lleva ${elapsed ?? "?"} minutos y va ${goals.home ?? 0}-${goals.away ?? 0}.

ESTRUCTURA (2 párrafos máximo, cortos y directos):
1. Lo que está pasando — analiza el marcador actual, quién domina según las estadísticas en vivo (posesión, tiros, tiros al arco), eventos clave (goles, tarjetas, cambios). Comenta las formaciones y si algún equipo cambió su planteamiento. Sé concreto con datos del partido.
2. Proyección y cuotas — si el campo "liveOdds" en los datos NO es null, analiza las cuotas exactas de 1xBet y qué refleja el mercado sobre el resultado. Si "liveOdds" ES null, en lugar de cuotas analiza el dominio del partido: ¿qué equipo está mejor posicionado para ganar según los datos en vivo? ¿qué necesitaría el otro para remontar o sostener el resultado?

REGLAS:
- Idioma: español. Tono: directo, presente ("está dominando", "lleva", "tiene").
- NUNCA hables en futuro como si el partido no hubiera empezado. El partido YA está en juego.
- Máximo 5-6 oraciones por párrafo.
- Si "liveOdds" es null, NUNCA escribas frases como "no hay cuotas", "no se encontraron cuotas", "las cuotas no están disponibles" ni ninguna variante. Simplemente omite el tema de cuotas.
- Cuando haya cuotas, siempre menciona "1xBet" por nombre.
- NO inventes datos. Sin markdown, sin emojis, sin introducciones.`;

    const completion = await withRetry(() =>
      openai.responses.create({
        model: "gpt-5-mini",
        reasoning: { effort: "low" },
        instructions: systemPrompt,
        input: `Datos en vivo del partido:\n\n${JSON.stringify(liveContext, null, 2)}`,
      })
    );

    return completion.output_text || "No se pudo generar el análisis en vivo.";
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

  /**
   * Returns featured/highlighted matches for a given date, scored automatically.
   */
  async getFeaturedMatches(date: string, limit = 10): Promise<FeaturedMatch[]> {
    const ttlSeconds = getFeaturedMatchesTtlSeconds(date);
    const cacheKey = buildFeaturedMatchesCacheKey(date);

    const result = await this.getOrComputeCachedValue<FeaturedMatch[]>({
      cacheKey,
      ttlSeconds,
      compute: () => this.computeFeaturedMatches(date, limit),
    });

    if (result.cacheHit) {
      logInfo("insights.featured.cache_hit", { date, cacheKey, ttlSeconds });
    }

    return result.value;
  }

  private async computeFeaturedMatches(
    date: string,
    limit: number
  ): Promise<FeaturedMatch[]> {
    const fixturesRes = await footballService.getFixtures({ date });
    const fixtures = fixturesRes.response ?? [];

    if (fixtures.length === 0) return [];

    // Group fixtures by league to batch-fetch standings
    const leagueIds = [...new Set(fixtures.map((f) => f.league.id))];
    const standingsMap = new Map<number, Array<{ team?: { id?: number }; rank?: number }>>();

    // Fetch standings for all leagues in parallel (max 15 to avoid overload)
    const leaguesToFetch = leagueIds.slice(0, 15);
    const standingsResults = await Promise.all(
      leaguesToFetch.map((leagueId) => {
        const season = fixtures.find((f) => f.league.id === leagueId)?.league.season;
        if (!season) return Promise.resolve({ leagueId, standings: [] });
        return footballService
          .getStandings({ league: leagueId, season })
          .then((res) => ({
            leagueId,
            standings: (res.response?.[0]?.league?.standings?.[0] ?? []) as Array<{
              team?: { id?: number };
              rank?: number;
            }>,
          }))
          .catch(() => ({ leagueId, standings: [] as Array<{ team?: { id?: number }; rank?: number }> }));
      })
    );

    for (const { leagueId, standings } of standingsResults) {
      if (standings.length > 0) standingsMap.set(leagueId, standings);
    }

    // Score each fixture
    const scored = fixtures.map((f) => {
      const leagueTier = getLeagueTier(f.league.id);
      const standings = standingsMap.get(f.league.id) ?? [];
      const homeRank = standings.find((s) => s.team?.id === f.teams.home.id)?.rank ?? null;
      const awayRank = standings.find((s) => s.team?.id === f.teams.away.id)?.rank ?? null;
      const round = f.league.round ?? "";

      const score = computeMatchRelevanceScore({
        leagueTier,
        homeRank,
        awayRank,
        round,
        totalTeams: standings.length,
      });

      return {
        fixtureId: f.fixture.id,
        date: f.fixture.date,
        status: f.fixture.status.short,
        league: {
          id: f.league.id,
          name: f.league.name,
          country: f.league.country,
          logo: f.league.logo,
          round: f.league.round,
        },
        homeTeam: {
          id: f.teams.home.id,
          name: f.teams.home.name,
          logo: f.teams.home.logo ?? null,
          rank: homeRank,
        },
        awayTeam: {
          id: f.teams.away.id,
          name: f.teams.away.name,
          logo: f.teams.away.logo ?? null,
          rank: awayRank,
        },
        score: {
          home: f.goals.home,
          away: f.goals.away,
        },
        relevanceScore: score,
        tier: leagueTier,
      } satisfies FeaturedMatch;
    });

    return scored
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }
}

export const insightsService = new InsightsService();

// ─── Featured Matches Types & Scoring ────────────────────────────────────────

export type FeaturedMatch = {
  fixtureId: number;
  date: string;
  status: string;
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    round: string;
  };
  homeTeam: {
    id: number;
    name: string;
    logo: string | null;
    rank: number | null;
  };
  awayTeam: {
    id: number;
    name: string;
    logo: string | null;
    rank: number | null;
  };
  score: {
    home: number | null;
    away: number | null;
  };
  relevanceScore: number;
  tier: number;
};

// ─── League Tiers ────────────────────────────────────────────────────────────
// Tier 1 = elite (40pts), Tier 2 = top (28pts), Tier 3 = notable (16pts), Tier 4 = default (4pts)

const TIER_1_LEAGUES = new Set([
  // UEFA Champions League, Europa League, Conference League
  2, 3, 848,
  // World Cup, Euro, Copa América
  1, 4, 9,
  // Top 5 domestic leagues
  39,  // Premier League
  140, // La Liga
  135, // Serie A
  78,  // Bundesliga
  61,  // Ligue 1
  // Copa Libertadores, Copa Sudamericana
  13, 11,
]);

const TIER_2_LEAGUES = new Set([
  // Strong domestic leagues
  94,  // Primeira Liga (Portugal)
  88,  // Eredivisie (Netherlands)
  144, // Belgian Pro League
  203, // Süper Lig (Turkey)
  235, // Russian Premier League
  218, // Saudi Pro League
  262, // Liga MX
  128, // Liga Profesional Argentina
  71,  // Brasileirão Serie A
  169, // Liga Dimayor Colombia
  // UEFA Nations League, World Cup Qualifiers
  5, 32, 34,
  // FA Cup, Copa del Rey, Coppa Italia, DFB Pokal, Coupe de France
  45, 143, 137, 81, 66,
  // Community Shields, Super Cups
  528, 556, 531, 529, 547,
  // MLS
  253,
  // Championship (England)
  40,
]);

const TIER_3_LEAGUES = new Set([
  // Second divisions of top leagues
  41,  // League One (England)
  42,  // League Two (England)
  141, // La Liga 2
  136, // Serie B (Italy)
  79,  // 2. Bundesliga
  62,  // Ligue 2
  // Other notable leagues
  113, // Allsvenskan (Sweden)
  103, // Eliteserien (Norway)
  119, // Superliga (Denmark)
  106, // Ekstraklasa (Poland)
  179, // Scottish Premiership
  307, // Pro League (Saudi 2nd div)
  345, // Czech First League
  283, // Egyptian Premier League
]);

function getLeagueTier(leagueId: number): number {
  if (TIER_1_LEAGUES.has(leagueId)) return 1;
  if (TIER_2_LEAGUES.has(leagueId)) return 2;
  if (TIER_3_LEAGUES.has(leagueId)) return 3;
  return 4;
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

function computeMatchRelevanceScore(input: {
  leagueTier: number;
  homeRank: number | null;
  awayRank: number | null;
  round: string;
  totalTeams: number;
}): number {
  let score = 0;
  const { leagueTier, homeRank, awayRank, round, totalTeams } = input;

  // 1. League tier (max 40)
  switch (leagueTier) {
    case 1: score += 40; break;
    case 2: score += 28; break;
    case 3: score += 16; break;
    default: score += 4; break;
  }

  // 2. Table position (max 25)
  if (homeRank !== null && awayRank !== null && totalTeams > 0) {
    const topThreshold = Math.max(Math.ceil(totalTeams * 0.25), 3);
    const bottomThreshold = Math.floor(totalTeams * 0.75);

    const bothTop = homeRank <= topThreshold && awayRank <= topThreshold;
    const topVsBottom =
      (homeRank <= topThreshold && awayRank >= bottomThreshold) ||
      (awayRank <= topThreshold && homeRank >= bottomThreshold);
    const oneTop = homeRank <= topThreshold || awayRank <= topThreshold;

    if (bothTop) score += 25;
    else if (topVsBottom) score += 18; // Title vs relegation drama
    else if (oneTop) score += 10;
  }

  // 3. Round context (max 20)
  const roundLower = round.toLowerCase();
  if (roundLower.includes("final") && !roundLower.includes("semi") && !roundLower.includes("quarter")) {
    score += 20;
  } else if (roundLower.includes("semi")) {
    score += 17;
  } else if (roundLower.includes("quarter")) {
    score += 14;
  } else if (roundLower.includes("round of 16") || roundLower.includes("8th")) {
    score += 10;
  } else if (roundLower.includes("group")) {
    score += 5;
  }
  // Check for late-season domestic rounds (high stakes)
  const roundMatch = round.match(/(\d+)$/);
  if (roundMatch && totalTeams > 0) {
    const roundNum = parseInt(roundMatch[1], 10);
    const totalRounds = (totalTeams - 1) * 2;
    if (totalRounds > 0 && roundNum / totalRounds >= 0.85) {
      score += 8; // Last ~15% of the season
    }
  }

  // 4. Derby/classic detection via rank proximity (max 10)
  if (homeRank !== null && awayRank !== null) {
    const rankDiff = Math.abs(homeRank - awayRank);
    if (rankDiff <= 2 && homeRank <= 6) score += 10; // Top teams neck-and-neck
    else if (rankDiff <= 3 && homeRank <= 10) score += 5;
  }

  return score;
}

