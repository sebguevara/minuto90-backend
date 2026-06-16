/**
 * Gathers ALL post-match data for a finished fixture and shapes it into a single
 * context object the LLM can turn into a journalistic news article.
 *
 * Reuses the same football endpoints and per-period stats the existing post-match
 * summary uses (insights.service.computePostMatchSummary), and layers on a
 * `tournamentContext` block so the article can analyze the competition correctly:
 * league table position, group standings, or knockout aggregate / advancement.
 */
import { footballService } from "../../sports/application/football.service";
import type {
  ApiFootballFixtureItem,
  ApiFootballStandingRow,
} from "../../sports/domain/football.types";
import { getFixtureStatsByPeriodResponse } from "../../../workers/halftime-snapshot";
import {
  isFirstLegRound,
  isSecondLegRound,
} from "../../insights/infrastructure/aggregate-detection";
import { getFeaturedCompetitionType } from "../../insights/infrastructure/featured-competition-priority";
import {
  classifyTournamentPhase,
  type TournamentPhase,
} from "./match-news.logic";

function formatStandingRow(row: ApiFootballStandingRow | null | undefined) {
  if (!row) return null;
  return {
    position: row.rank,
    team: row.team?.name ?? null,
    points: row.points,
    played: row.all?.played ?? null,
    win: row.all?.win ?? null,
    draw: row.all?.draw ?? null,
    lose: row.all?.lose ?? null,
    goalsDiff: row.goalsDiff,
    form: row.form,
    group: row.group || null,
    description: row.description ?? null,
  };
}

export type PostMatchContext = ReturnType<typeof shapeContext>;

function shapeContext(input: {
  fixtureData: ApiFootballFixtureItem;
  statistics: any[];
  events: any[];
  lineups: any[];
  topPlayers: any[];
  statsByHalf: any;
  tournamentContext: Record<string, unknown>;
}) {
  const { fixtureData } = input;
  const { league, teams, goals, score } = fixtureData;

  const winnerTeam =
    teams.home.winner === true
      ? teams.home.name
      : teams.away.winner === true
        ? teams.away.name
        : null;

  return {
    tournament: league.name,
    country: league.country,
    round: league.round,
    season: league.season,
    homeTeam: teams.home.name,
    awayTeam: teams.away.name,
    finalScore: `${goals.home} - ${goals.away}`,
    halftimeScore: `${score.halftime.home} - ${score.halftime.away}`,
    extraTimeScore:
      score.extratime.home !== null || score.extratime.away !== null
        ? `${score.extratime.home} - ${score.extratime.away}`
        : null,
    penaltyScore:
      score.penalty.home !== null || score.penalty.away !== null
        ? `${score.penalty.home} - ${score.penalty.away}`
        : null,
    winnerTeam,
    events: input.events,
    statistics: input.statistics,
    lineups: input.lineups,
    topPlayers: input.topPlayers,
    statsByHalf: input.statsByHalf,
    tournamentContext: input.tournamentContext,
  };
}

async function buildTournamentContext(
  fixtureData: ApiFootballFixtureItem
): Promise<Record<string, unknown>> {
  const { league, teams, score } = fixtureData;
  const homeId = teams.home.id;
  const awayId = teams.away.id;

  const competitionType = getFeaturedCompetitionType(league.id);
  const phase: TournamentPhase = classifyTournamentPhase({
    round: league.round,
    competitionType,
  });

  const base: Record<string, unknown> = {
    phase,
    competitionType,
    league: {
      id: league.id,
      name: league.name,
      country: league.country,
      season: league.season,
      round: league.round,
    },
  };

  // --- Standings (league + group phases) ---
  if (phase === "league" || phase === "group") {
    const standingsRes = await footballService
      .getStandings({ league: league.id, season: league.season })
      .catch(() => ({ response: [] as any[] }));

    const groups: ApiFootballStandingRow[][] =
      standingsRes.response?.[0]?.league?.standings ?? [];
    const allRows = groups.flat();
    const homeRow = allRows.find((r) => r.team?.id === homeId) ?? null;
    const awayRow = allRows.find((r) => r.team?.id === awayId) ?? null;

    base.standings = {
      home: formatStandingRow(homeRow),
      away: formatStandingRow(awayRow),
    };

    if (phase === "group") {
      // Whole group table that contains the home team, so the article can describe
      // the qualification scenario (positions, points, who advances).
      const groupTable =
        groups.find((g) => g.some((r) => r.team?.id === homeId)) ?? null;
      base.groupName = homeRow?.group ?? awayRow?.group ?? null;
      base.groupTable = groupTable ? groupTable.map(formatStandingRow) : null;
    }
  }

  // --- Knockout (two-legged tie + single-leg deciders) ---
  if (phase === "knockout") {
    const secondLeg = isSecondLegRound(league.round);
    const firstLeg = isFirstLegRound(league.round);

    const knockout: Record<string, unknown> = {
      isFirstLeg: firstLeg,
      isSecondLeg: secondLeg,
      decidedByExtraTime: score.extratime.home !== null || score.extratime.away !== null,
      decidedByPenalties: score.penalty.home !== null || score.penalty.away !== null,
    };

    if (secondLeg) {
      const h2hRes = await footballService
        .getFixtureHeadToHead({ h2h: `${homeId}-${awayId}`, last: 5 })
        .catch(() => ({ response: [] as any[] }));
      const firstLegFixture = (h2hRes.response || []).find(
        (f: ApiFootballFixtureItem) =>
          f.league.id === league.id &&
          f.league.season === league.season &&
          isFirstLegRound(f.league.round)
      );
      if (firstLegFixture) {
        knockout.firstLegHomeTeam = firstLegFixture.teams.home.name;
        knockout.firstLegAwayTeam = firstLegFixture.teams.away.name;
        knockout.firstLegScore = `${firstLegFixture.goals.home} - ${firstLegFixture.goals.away}`;
      } else {
        knockout.firstLegScore = "desconocido";
      }
    }

    base.knockout = knockout;
  }

  return base;
}

/**
 * Builds the full post-match context for a finished fixture. The caller already has
 * the fixture envelope item (status FT/AET/PEN guaranteed by the caller).
 */
export async function buildPostMatchContext(
  fixtureId: number,
  fixtureData: ApiFootballFixtureItem
): Promise<PostMatchContext> {
  const [statsRes, eventsRes, lineupsRes, playersRes, tournamentContext] =
    await Promise.all([
      footballService.getFixtureStatistics({ fixture: fixtureId }).catch(() => ({ response: [] as any[] })),
      footballService.getFixtureEvents({ fixture: fixtureId }).catch(() => ({ response: [] as any[] })),
      footballService.getFixtureLineups({ fixture: fixtureId }).catch(() => ({ response: [] as any[] })),
      footballService.getFixturePlayers({ fixture: fixtureId }).catch(() => ({ response: [] as any[] })),
      buildTournamentContext(fixtureData),
    ]);

  const statistics = statsRes.response || [];
  const events = eventsRes.response || [];
  const lineups = lineupsRes.response || [];
  const playersData = playersRes.response || [];
  const statsByPeriod = await getFixtureStatsByPeriodResponse(fixtureId, statistics);

  const topPlayers = playersData.flatMap((t: any) =>
    (t.players ?? [])
      .filter((p: any) => p.statistics?.[0]?.games?.rating)
      .sort(
        (a: any, b: any) =>
          parseFloat(b.statistics[0].games.rating ?? "0") -
          parseFloat(a.statistics[0].games.rating ?? "0")
      )
      .slice(0, 5)
      .map((p: any) => {
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

  const mappedEvents = events.map((e: any) => ({
    time: `${e.time.elapsed}${e.time.extra ? "+" + e.time.extra : ""}'`,
    team: e.team.name,
    player: e.player.name,
    assist: e.assist?.name ?? null,
    type: e.type,
    detail: e.detail,
  }));

  const mappedStats = statistics.map((s: any) => ({
    team: s.team.name,
    stats: s.statistics,
  }));

  const mappedLineups = lineups.map((l: any) => ({
    team: l.team.name,
    formation: l.formation,
    startXI: (l.startXI ?? []).map((p: any) => p.player.name),
    coach: l.coach?.name ?? null,
  }));

  const statsByHalf = statsByPeriod.hasSnapshot
    ? {
        periods: statsByPeriod.periods.map((period) => ({
          id: period.id,
          label: period.label,
          status: period.status,
          teams: period.teams.map((team) => ({
            team: team.teamName,
            stats: team.statistics,
          })),
        })),
      }
    : null;

  return shapeContext({
    fixtureData,
    statistics: mappedStats,
    events: mappedEvents,
    lineups: mappedLineups,
    topPlayers,
    statsByHalf,
    tournamentContext,
  });
}
