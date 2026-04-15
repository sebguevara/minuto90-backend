import type {
  AnalystChatIntent,
  ResolvedEntities,
} from "../domain/analyst-chat.types";
import { footballService } from "../../sports/application/football.service";
import { getTeamMatchProfile } from "../../stats/application/stats.service";
import { encode } from "@toon-format/toon";
import {
  encodeStandings,
  encodeH2H,
  encodeEvents,
  encodeStatistics,
  encodeLineups,
  encodeTopScorers,
  encodeInjuries,
  encodeTransfers,
  encodeFixturePlayers,
  buildPlainContext,
} from "./toon-encoder";

// ── Helpers ──────────────────────────────────────────────────────────────────

const safe = <T>(fn: () => Promise<T>): Promise<T | null> =>
  fn().catch(() => null);

function currentSeason(): number {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

/** Resolve the team's primary league from their most recent fixture. */
async function resolveTeamLeague(
  teamId: number
): Promise<{ leagueId: number; season: number } | null> {
  const res = await safe(() =>
    footballService.getFixtures({ team: teamId, last: 1 })
  );
  const fixture = res?.response?.[0];
  if (!fixture?.league?.id) return null;
  return { leagueId: fixture.league.id, season: fixture.league.season };
}

// ── Per-intent assemblers ────────────────────────────────────────────────────

async function assembleMatchPreview(entities: ResolvedEntities): Promise<string> {
  const fixtureId = entities.fixtureId;
  const teamIds = entities.teamIds ?? [];

  if (!fixtureId) return "No se encontro un partido relevante para esta consulta.";

  const [fixtureRes, predRes, oddsRes] = await Promise.all([
    safe(() => footballService.getFixtures({ id: fixtureId })),
    safe(() => footballService.getPredictions({ fixture: fixtureId })),
    safe(() => footballService.getOdds({ fixture: fixtureId })),
  ]);

  const fixture = fixtureRes?.response?.[0] ?? null;
  const prediction = predRes?.response?.[0] ?? null;
  const homeId = fixture?.teams?.home?.id ?? teamIds[0];
  const awayId = fixture?.teams?.away?.id ?? teamIds[1];

  const [standingsRes, h2hRes, lineupsRes, homeProfile, awayProfile] =
    await Promise.all([
      fixture?.league?.id
        ? safe(() =>
            footballService.getStandings({
              league: fixture.league.id,
              season: fixture.league.season,
            })
          )
        : null,
      homeId && awayId
        ? safe(() =>
            footballService.getFixtureHeadToHead({
              h2h: `${homeId}-${awayId}`,
              last: 5,
            })
          )
        : null,
      safe(() => footballService.getFixtureLineups({ fixture: fixtureId })),
      homeId ? safe(() => getTeamMatchProfile(homeId)) : null,
      awayId ? safe(() => getTeamMatchProfile(awayId)) : null,
    ]);

  const standings = standingsRes?.response?.[0]?.league?.standings?.[0] ?? [];
  const h2h = h2hRes?.response ?? [];
  const lineups = lineupsRes?.response ?? [];

  // Extract 1xBet odds
  const oddsData = oddsRes?.response?.[0] ?? null;
  const oneXBet = oddsData?.bookmakers?.find((bk: any) =>
    bk.name.toLowerCase().includes("1xbet")
  );
  const matchWinner = oneXBet?.bets?.find(
    (b: any) => b.name === "Match Winner"
  );
  const odds = matchWinner
    ? matchWinner.values.reduce(
        (acc: any, v: any) => {
          if (v.value === "Home") acc.local = v.odd;
          else if (v.value === "Draw") acc.empate = v.odd;
          else if (v.value === "Away") acc.visita = v.odd;
          return acc;
        },
        {} as Record<string, string>
      )
    : null;

  const sections: string[] = [];
  sections.push(
    buildPlainContext({
      partido: `${fixture?.teams?.home?.name ?? "?"} vs ${fixture?.teams?.away?.name ?? "?"}`,
      liga: fixture?.league?.name,
      ronda: fixture?.league?.round,
      fecha: fixture?.fixture?.date
        ? new Date(fixture.fixture.date).toISOString().slice(0, 16)
        : "?",
    })
  );

  if (standings.length) sections.push(encodeStandings(standings));
  if (h2h.length) sections.push(encodeH2H(h2h));
  if (lineups.length) sections.push(encodeLineups(lineups));

  if (prediction) {
    sections.push(
      buildPlainContext({
        prediccion: {
          favorito: prediction.predictions?.winner?.name ?? "?",
          probabilidad_local: prediction.predictions?.percent?.home ?? "?",
          probabilidad_empate: prediction.predictions?.percent?.draw ?? "?",
          probabilidad_visita: prediction.predictions?.percent?.away ?? "?",
          consejo: prediction.predictions?.advice ?? "",
        },
      })
    );
  }

  if (odds) {
    sections.push(buildPlainContext({ cuotas_1xbet: odds }));
  }

  if (homeProfile) {
    sections.push(
      buildPlainContext({
        perfil_local: {
          fortalezas: (homeProfile as any).data?.characteristics?.strengths?.join(", ") ?? "",
          debilidades: (homeProfile as any).data?.characteristics?.weaknesses?.join(", ") ?? "",
          estilo: (homeProfile as any).data?.characteristics?.style?.join(", ") ?? "",
        },
      })
    );
  }

  if (awayProfile) {
    sections.push(
      buildPlainContext({
        perfil_visitante: {
          fortalezas: (awayProfile as any).data?.characteristics?.strengths?.join(", ") ?? "",
          debilidades: (awayProfile as any).data?.characteristics?.weaknesses?.join(", ") ?? "",
          estilo: (awayProfile as any).data?.characteristics?.style?.join(", ") ?? "",
        },
      })
    );
  }

  return sections.join("\n\n");
}

async function assembleMatchLive(entities: ResolvedEntities): Promise<string> {
  const fixtureId = entities.fixtureId;
  if (!fixtureId)
    return "No se encontro un partido en vivo relevante para esta consulta.";

  const [fixtureRes, statsRes, eventsRes] = await Promise.all([
    safe(() => footballService.getFixtures({ id: fixtureId })),
    safe(() => footballService.getFixtureStatistics({ fixture: fixtureId })),
    safe(() => footballService.getFixtureEvents({ fixture: fixtureId })),
  ]);

  const fixture = fixtureRes?.response?.[0] ?? null;
  const stats = statsRes?.response ?? [];
  const events = eventsRes?.response ?? [];

  const sections: string[] = [];
  sections.push(
    buildPlainContext({
      partido: `${fixture?.teams?.home?.name ?? "?"} vs ${fixture?.teams?.away?.name ?? "?"}`,
      marcador: `${fixture?.goals?.home ?? "?"} - ${fixture?.goals?.away ?? "?"}`,
      minuto: fixture?.fixture?.status?.elapsed ?? "?",
      estado: fixture?.fixture?.status?.long ?? "?",
      liga: fixture?.league?.name,
    })
  );

  if (stats.length) sections.push(encodeStatistics(stats));
  if (events.length) sections.push(encodeEvents(events));

  return sections.join("\n\n");
}

async function assembleMatchResult(entities: ResolvedEntities): Promise<string> {
  const fixtureId = entities.fixtureId;

  // No specific fixture: fallback to match day results
  if (!fixtureId) {
    return assembleMatchDay(entities);
  }

  const [fixtureRes, statsRes, eventsRes, playersRes] = await Promise.all([
    safe(() => footballService.getFixtures({ id: fixtureId })),
    safe(() => footballService.getFixtureStatistics({ fixture: fixtureId })),
    safe(() => footballService.getFixtureEvents({ fixture: fixtureId })),
    safe(() => footballService.getFixturePlayers({ fixture: fixtureId })),
  ]);

  const fixture = fixtureRes?.response?.[0] ?? null;
  const stats = statsRes?.response ?? [];
  const events = eventsRes?.response ?? [];
  const players = (playersRes?.response ?? []).flatMap(
    (t: any) => t.players ?? []
  );

  const sections: string[] = [];
  sections.push(
    buildPlainContext({
      partido: `${fixture?.teams?.home?.name ?? "?"} vs ${fixture?.teams?.away?.name ?? "?"}`,
      resultado_final: `${fixture?.goals?.home ?? "?"} - ${fixture?.goals?.away ?? "?"}`,
      liga: fixture?.league?.name,
      ronda: fixture?.league?.round,
      fecha: fixture?.fixture?.date
        ? new Date(fixture.fixture.date).toISOString().slice(0, 10)
        : "?",
    })
  );

  if (stats.length) sections.push(encodeStatistics(stats));
  if (events.length) sections.push(encodeEvents(events));
  if (players.length) sections.push(encodeFixturePlayers(players));

  return sections.join("\n\n");
}

async function assembleStandings(entities: ResolvedEntities): Promise<string> {
  const leagueId = entities.leagueId;
  if (!leagueId) return "No se pudo determinar la liga para esta consulta.";

  const season = entities.season ?? currentSeason();
  const res = await safe(() =>
    footballService.getStandings({ league: leagueId, season })
  );
  const standings = res?.response?.[0]?.league?.standings?.[0] ?? [];
  if (!standings.length) return "No hay datos de posiciones disponibles.";

  return encodeStandings(standings);
}

async function assembleTeamForm(entities: ResolvedEntities): Promise<string> {
  const teamId = entities.teamIds?.[0];
  if (!teamId) return "No se pudo identificar el equipo.";

  let leagueId = entities.leagueId;
  let season = entities.season ?? currentSeason();

  if (!leagueId) {
    const resolved = await resolveTeamLeague(teamId);
    if (resolved) {
      leagueId = resolved.leagueId;
      season = resolved.season;
    }
  }

  const [fixturesRes, statsRes] = await Promise.all([
    safe(() => footballService.getFixtures({ team: teamId, last: 10 })),
    leagueId
      ? safe(() =>
          footballService.getTeamStatistics({ team: teamId, league: leagueId, season })
        )
      : null,
  ]);

  const fixtures = fixturesRes?.response ?? [];
  if (!fixtures.length) return "No hay partidos recientes disponibles.";

  const sections: string[] = [];

  const stats = (statsRes as any)?.response ?? null;
  if (stats) {
    sections.push(
      buildPlainContext({
        equipo: stats.team?.name ?? "?",
        liga: stats.league?.name ?? "?",
        temporada: season,
        forma: stats.form ?? "",
        partidos: {
          jugados: stats.fixtures?.played?.total ?? 0,
          ganados: stats.fixtures?.wins?.total ?? 0,
          empatados: stats.fixtures?.draws?.total ?? 0,
          perdidos: stats.fixtures?.loses?.total ?? 0,
        },
        goles: {
          a_favor: stats.goals?.for?.total?.total ?? 0,
          en_contra: stats.goals?.against?.total?.total ?? 0,
        },
      })
    );
  }

  const slim = fixtures.map((f: any) => ({
    fecha: new Date(f.fixture.date).toISOString().slice(0, 10),
    rival:
      f.teams?.home?.id === teamId
        ? f.teams?.away?.name
        : f.teams?.home?.name,
    marcador: `${f.goals?.home ?? "?"}-${f.goals?.away ?? "?"}`,
    local: f.teams?.home?.id === teamId ? "Si" : "No",
    resultado:
      f.teams?.home?.id === teamId
        ? f.teams?.home?.winner
          ? "V"
          : f.teams?.away?.winner
            ? "D"
            : "E"
        : f.teams?.away?.winner
          ? "V"
          : f.teams?.home?.winner
            ? "D"
            : "E",
  }));

  sections.push(encode({ ultimos_partidos: slim }));

  return sections.join("\n\n");
}

async function assembleTeamStats(entities: ResolvedEntities): Promise<string> {
  const teamId = entities.teamIds?.[0];
  if (!teamId) return "No se pudo identificar el equipo.";

  let leagueId = entities.leagueId;
  let season = entities.season ?? currentSeason();

  if (!leagueId) {
    const resolved = await resolveTeamLeague(teamId);
    if (resolved) {
      leagueId = resolved.leagueId;
      season = resolved.season;
    }
  }

  const [statsRes, profileRes] = await Promise.all([
    leagueId
      ? safe(() =>
          footballService.getTeamStatistics({
            team: teamId,
            league: leagueId,
            season,
          })
        )
      : null,
    safe(() => getTeamMatchProfile(teamId)),
  ]);

  const sections: string[] = [];

  const stats = (statsRes as any)?.response ?? null;
  if (stats) {
    sections.push(
      buildPlainContext({
        equipo: stats.team?.name ?? "?",
        liga: stats.league?.name ?? "?",
        forma: stats.form ?? "",
        partidos: {
          jugados: stats.fixtures?.played?.total ?? 0,
          ganados: stats.fixtures?.wins?.total ?? 0,
          empatados: stats.fixtures?.draws?.total ?? 0,
          perdidos: stats.fixtures?.loses?.total ?? 0,
        },
        goles: {
          a_favor: stats.goals?.for?.total?.total ?? 0,
          en_contra: stats.goals?.against?.total?.total ?? 0,
          promedio_favor: stats.goals?.for?.average?.total ?? "?",
          promedio_contra: stats.goals?.against?.average?.total ?? "?",
        },
        vallas_invictas: stats.clean_sheet?.total ?? 0,
        sin_anotar: stats.failed_to_score?.total ?? 0,
      })
    );
  }

  if (profileRes) {
    sections.push(
      buildPlainContext({
        perfil: {
          fortalezas:
            (profileRes as any).data?.characteristics?.strengths?.join(", ") ?? "",
          debilidades:
            (profileRes as any).data?.characteristics?.weaknesses?.join(", ") ?? "",
          estilo:
            (profileRes as any).data?.characteristics?.style?.join(", ") ?? "",
        },
      })
    );
  }

  return sections.join("\n\n") || "No hay estadisticas disponibles.";
}

async function assembleH2H(entities: ResolvedEntities): Promise<string> {
  const teamIds = entities.teamIds ?? [];
  if (teamIds.length < 2)
    return "Se necesitan dos equipos para el historial directo.";

  const res = await safe(() =>
    footballService.getFixtureHeadToHead({
      h2h: `${teamIds[0]}-${teamIds[1]}`,
      last: 10,
    })
  );
  const fixtures = res?.response ?? [];
  if (!fixtures.length) return "No hay historial directo disponible.";

  return encodeH2H(fixtures);
}

async function assembleTopScorers(entities: ResolvedEntities): Promise<string> {
  const leagueId = entities.leagueId;
  if (!leagueId) return "No se pudo determinar la liga.";

  const season = entities.season ?? currentSeason();
  const res = await safe(() =>
    footballService.getPlayersTopScorers({ league: leagueId, season })
  );
  const scorers = res?.response ?? [];
  if (!scorers.length) return "No hay datos de goleadores disponibles.";

  return encodeTopScorers(scorers);
}

async function assembleInjuries(entities: ResolvedEntities): Promise<string> {
  const teamId = entities.teamIds?.[0];
  if (!teamId) return "No se pudo identificar el equipo.";

  const season = entities.season ?? currentSeason();
  const res = await safe(() =>
    footballService.getInjuries({ team: teamId, season })
  );
  const injuries = res?.response ?? [];
  if (!injuries.length) return "No hay lesionados reportados actualmente.";

  return encodeInjuries(injuries.slice(0, 15));
}

async function assembleTransfers(entities: ResolvedEntities): Promise<string> {
  const teamId = entities.teamIds?.[0];
  if (!teamId) return "No se pudo identificar el equipo.";

  const res = await safe(() =>
    footballService.getTransfers({ team: teamId })
  );
  const transfers = res?.response ?? [];
  if (!transfers.length) return "No hay fichajes disponibles.";

  return encodeTransfers(transfers.slice(0, 5));
}

// ── Match day (fixtures by date + optional league) ──────────────────────────

async function assembleMatchDay(entities: ResolvedEntities): Promise<string> {
  const date = entities.date ?? new Date().toISOString().slice(0, 10);
  const leagueId = entities.leagueId;

  const params: Record<string, string | number> = { date };
  if (leagueId) params.league = leagueId;
  if (entities.season) params.season = entities.season;

  const res = await safe(() => footballService.getFixtures(params));
  const fixtures = res?.response ?? [];
  if (!fixtures.length) return `No hay partidos para la fecha ${date}${leagueId ? " en esta liga" : ""}.`;

  // Sort: finished first, then live, then scheduled
  const statusOrder = (s: string) => {
    if (["FT", "AET", "PEN"].includes(s)) return 0;
    if (["1H", "2H", "ET", "HT", "LIVE", "BT", "P"].includes(s)) return 1;
    return 2;
  };

  const sorted = [...fixtures].sort(
    (a, b) => statusOrder(a.fixture.status.short) - statusOrder(b.fixture.status.short)
  );

  // Limit to most relevant (max 20)
  const top = sorted.slice(0, 20);
  const rows = top.map((f: any) => ({
    liga: f.league.name,
    ronda: f.league.round,
    local: f.teams.home.name,
    visitante: f.teams.away.name,
    marcador: `${f.goals.home ?? "-"} - ${f.goals.away ?? "-"}`,
    estado: f.fixture.status.long,
    hora: new Date(f.fixture.date).toISOString().slice(11, 16),
  }));

  return encode({ fecha: date, partidos: rows });
}

// ── Player stats ────────────────────────────────────────────────────────────

async function assemblePlayerStats(entities: ResolvedEntities): Promise<string> {
  const leagueId = entities.leagueId;
  const teamId = entities.teamIds?.[0];
  const season = entities.season ?? currentSeason();

  // Try top scorers if we have a league
  if (leagueId) {
    const res = await safe(() =>
      footballService.getPlayersTopScorers({ league: leagueId, season })
    );
    const scorers = res?.response ?? [];
    if (scorers.length) return encodeTopScorers(scorers);
  }

  // Fallback: team stats if we have a team
  if (teamId) {
    return assembleTeamStats(entities);
  }

  return "No se pudo obtener estadisticas de jugadores. Intenta especificar un equipo o liga.";
}

// ── Main assembler ───────────────────────────────────────────────────────────

const ASSEMBLERS: Record<
  AnalystChatIntent,
  (entities: ResolvedEntities) => Promise<string>
> = {
  MATCH_DAY: assembleMatchDay,
  MATCH_PREVIEW: assembleMatchPreview,
  MATCH_LIVE: assembleMatchLive,
  MATCH_RESULT: assembleMatchResult,
  STANDINGS: assembleStandings,
  TEAM_FORM: assembleTeamForm,
  TEAM_STATS: assembleTeamStats,
  PLAYER_STATS: assemblePlayerStats,
  HEAD_TO_HEAD: assembleH2H,
  TOP_SCORERS: assembleTopScorers,
  PREDICTIONS: assembleMatchPreview,
  INJURIES: assembleInjuries,
  TRANSFERS: assembleTransfers,
  GENERAL: async () => "",
};

/** Assemble context data for a classified intent. */
export async function assembleContext(
  intent: AnalystChatIntent,
  entities: ResolvedEntities
): Promise<string> {
  const assembler = ASSEMBLERS[intent];
  return assembler(entities);
}
