import { encode } from "@toon-format/toon";
import type { ApiFootballFixtureItem } from "../../sports/domain/football.types";

// ── Standings ────────────────────────────────────────────────────────────────

export function encodeStandings(standings: any[]): string {
  const slim = standings.map((s) => ({
    pos: s.rank,
    equipo: s.team?.name ?? "?",
    pts: s.points,
    pj: s.all?.played ?? 0,
    g: s.all?.win ?? 0,
    e: s.all?.draw ?? 0,
    p: s.all?.lose ?? 0,
    gf: s.all?.goals?.for ?? 0,
    gc: s.all?.goals?.against ?? 0,
    dg: s.goalsDiff,
    forma: s.form ?? "",
  }));
  return encode({ posiciones: slim });
}

// ── H2H fixtures ─────────────────────────────────────────────────────────────

export function encodeH2H(fixtures: ApiFootballFixtureItem[]): string {
  const slim = fixtures.map((f) => ({
    fecha: new Date(f.fixture.date).toISOString().slice(0, 10),
    local: f.teams?.home?.name ?? "?",
    visitante: f.teams?.away?.name ?? "?",
    marcador: `${f.goals?.home ?? "?"}-${f.goals?.away ?? "?"}`,
    liga: f.league?.name ?? "",
  }));
  return encode({ historial: slim });
}

// ── Match events ─────────────────────────────────────────────────────────────

export function encodeEvents(events: any[]): string {
  const slim = events
    .filter((e: any) => e?.type)
    .map((e: any) => ({
      min: `${e.time?.elapsed ?? "?"}${e.time?.extra ? "+" + e.time.extra : ""}'`,
      equipo: e.team?.name ?? "?",
      jugador: e.player?.name ?? "?",
      tipo: e.type ?? "",
      detalle: e.detail ?? "",
    }));
  return encode({ eventos: slim });
}

// ── Match statistics ─────────────────────────────────────────────────────────

export function encodeStatistics(stats: any[]): string {
  if (!stats?.length) return "";

  const slim = stats.map((teamStats: any) => {
    const row: Record<string, any> = { equipo: teamStats.team?.name ?? "?" };
    for (const stat of teamStats.statistics ?? []) {
      const key = (stat.type ?? "")
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "");
      if (key) row[key] = stat.value ?? 0;
    }
    return row;
  });
  return encode({ estadisticas: slim });
}

// ── Lineups ──────────────────────────────────────────────────────────────────

export function encodeLineups(lineups: any[]): string {
  const sections: string[] = [];

  for (const lineup of lineups) {
    const teamName = lineup.team?.name ?? "?";
    const formation = lineup.formation ?? "?";
    const players = (lineup.startXI ?? []).map((p: any) => ({
      num: p.player?.number ?? "?",
      nombre: p.player?.name ?? "?",
      pos: p.player?.pos ?? "?",
    }));
    sections.push(
      `${teamName} (${formation}):\n${encode({ jugadores: players })}`
    );
  }

  return sections.join("\n\n");
}

// ── Top scorers ──────────────────────────────────────────────────────────────

export function encodeTopScorers(scorers: any[]): string {
  const slim = scorers.slice(0, 20).map((s: any, i: number) => ({
    pos: i + 1,
    jugador: s.player?.name ?? "?",
    equipo: s.statistics?.[0]?.team?.name ?? "?",
    goles: s.statistics?.[0]?.goals?.total ?? 0,
    asist: s.statistics?.[0]?.goals?.assists ?? 0,
    pj: s.statistics?.[0]?.games?.appearences ?? 0,
  }));
  return encode({ goleadores: slim });
}

// ── Injuries ─────────────────────────────────────────────────────────────────

export function encodeInjuries(injuries: any[]): string {
  const slim = injuries.map((inj: any) => ({
    jugador: inj.player?.name ?? "?",
    tipo: inj.player?.type ?? "?",
    razon: inj.player?.reason ?? "?",
    equipo: inj.team?.name ?? "?",
  }));
  return encode({ lesionados: slim });
}

// ── Transfers ────────────────────────────────────────────────────────────────

export function encodeTransfers(transfers: any[]): string {
  // Flatten nested transfers array
  const flat: any[] = [];
  for (const t of transfers) {
    for (const tr of t.transfers ?? []) {
      flat.push({
        jugador: t.player?.name ?? "?",
        de: tr.teams?.out?.name ?? "?",
        a: tr.teams?.in?.name ?? "?",
        fecha: tr.date ?? "?",
        tipo: tr.type ?? "?",
      });
    }
  }
  return encode({ fichajes: flat.slice(0, 20) });
}

// ── Player stats (from fixture players) ──────────────────────────────────────

export function encodeFixturePlayers(players: any[]): string {
  const slim = players
    .filter((p: any) => p.statistics?.[0]?.games?.minutes)
    .sort(
      (a: any, b: any) =>
        parseFloat(b.statistics?.[0]?.games?.rating ?? "0") -
        parseFloat(a.statistics?.[0]?.games?.rating ?? "0")
    )
    .slice(0, 10)
    .map((p: any) => {
      const s = p.statistics?.[0] ?? {};
      return {
        jugador: p.player?.name ?? "?",
        rating: s.games?.rating ?? "-",
        min: s.games?.minutes ?? 0,
        goles: s.goals?.total ?? 0,
        asist: s.goals?.assists ?? 0,
        pases: s.passes?.total ?? 0,
        tiros: s.shots?.total ?? 0,
      };
    });
  return encode({ jugadores_destacados: slim });
}

// ── Plain key-value context (non-uniform, no TOON benefit) ───────────────────

export function buildPlainContext(data: Record<string, any>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "object") {
      lines.push(`${key}:`);
      for (const [k, v] of Object.entries(value)) {
        if (v !== null && v !== undefined) {
          lines.push(`  ${k}: ${v}`);
        }
      }
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  return lines.join("\n");
}
