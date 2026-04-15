import type {
  AnalystChatIntent,
  ClassifiedIntent,
  ConversationTurn,
  ResolvedEntities,
} from "../domain/analyst-chat.types";
import { INTENT_META, INTENT_PRIORITY } from "../domain/analyst-chat.intents";
import { footballService } from "../../sports/application/football.service";

// ── Text normalization ───────────────────────────────────────────────────────

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Team aliases (most common Spanish-language names) ─────────────────────────

const TEAM_ALIASES: Record<string, number> = {
  // Spain
  "barca": 529, "barcelona": 529, "blaugrana": 529,
  "real madrid": 541, "madrid": 541, "merengues": 541,
  "atletico": 530, "atleti": 530, "colchoneros": 530, "atletico de madrid": 530,
  "sevilla": 536, "betis": 543,
  "real sociedad": 548, "sociedad": 548,
  "villarreal": 533, "valencia": 532,
  "athletic": 531, "athletic bilbao": 531,
  "girona": 547, "celta": 538, "celta de vigo": 538,
  "mallorca": 798, "getafe": 546, "osasuna": 727,
  // England
  "manchester city": 50, "man city": 50, "city": 50,
  "manchester united": 33, "man united": 33, "united": 33,
  "liverpool": 40, "chelsea": 49, "arsenal": 42,
  "tottenham": 47, "spurs": 47,
  "aston villa": 66, "villa": 66,
  "newcastle": 34, "brighton": 51, "west ham": 48,
  "wolves": 39, "wolverhampton": 39,
  "everton": 45, "crystal palace": 52, "nottingham forest": 65,
  "bournemouth": 35, "fulham": 36, "brentford": 55,
  // Italy
  "juventus": 496, "juve": 496,
  "milan": 489, "ac milan": 489,
  "inter": 505, "inter de milan": 505,
  "napoli": 492, "roma": 497, "lazio": 487,
  "atalanta": 499, "fiorentina": 502, "bologna": 500,
  // Germany
  "bayern": 157, "bayern munich": 157,
  "dortmund": 165, "borussia dortmund": 165,
  "leverkusen": 168, "bayer leverkusen": 168,
  "leipzig": 173, "rb leipzig": 173,
  "stuttgart": 172, "frankfurt": 169, "eintracht frankfurt": 169,
  "wolfsburg": 161,
  // France
  "psg": 85, "paris": 85, "paris saint germain": 85,
  "marsella": 81, "lyon": 80, "monaco": 91, "lille": 79,
  // Netherlands
  "ajax": 194, "psv": 197, "feyenoord": 215,
  // Portugal
  "benfica": 211, "porto": 212, "sporting": 228,
  // Argentina
  "boca": 451, "boca juniors": 451,
  "river": 435, "river plate": 435,
  "racing": 436, "independiente": 434, "san lorenzo": 437,
  "velez": 440, "velez sarsfield": 440,
  "estudiantes": 441, "talleres": 459,
  "huracan": 439, "argentinos": 442, "argentinos juniors": 442,
  "rosario central": 455, "newells": 456, "newells old boys": 456,
  // Brazil
  "flamengo": 127, "palmeiras": 121, "corinthians": 131,
  "sao paulo": 126, "santos": 128, "gremio": 130,
  "internacional": 119, "atletico mineiro": 1062, "cruzeiro": 1065,
  "botafogo": 132, "fluminense": 124, "vasco": 133,
  // Colombia
  "millonarios": 1129, "nacional": 1130, "atletico nacional": 1130,
  "santa fe": 1131, "america de cali": 1133, "junior": 1132,
  "deportivo cali": 1135,
  // Mexico
  "america": 2283, "club america": 2283,
  "chivas": 2282, "guadalajara": 2282,
  "cruz azul": 2284, "pumas": 2285,
  "monterrey": 2286, "tigres": 2287,
};

// ── League aliases ──────────────────────────────────────────────────────────

const LEAGUE_ALIASES: Record<string, { id: number; season?: number }> = {
  // European leagues — season resolved dynamically by currentSeason()
  "la liga": { id: 140 }, "liga espanola": { id: 140 }, "primera division espana": { id: 140 },
  "premier": { id: 39 }, "premier league": { id: 39 }, "liga inglesa": { id: 39 },
  "serie a": { id: 135 }, "calcio": { id: 135 }, "liga italiana": { id: 135 },
  "bundesliga": { id: 78 }, "liga alemana": { id: 78 },
  "ligue 1": { id: 61 }, "liga francesa": { id: 61 },
  "champions": { id: 2 }, "champions league": { id: 2 }, "ucl": { id: 2 },
  "europa league": { id: 3 }, "europa": { id: 3 },
  "conference league": { id: 848 },
  "eredivisie": { id: 88 }, "liga holandesa": { id: 88 },
  "liga portuguesa": { id: 94 }, "primeira liga": { id: 94 },
  // South America
  "liga argentina": { id: 128 }, "liga profesional": { id: 128 },
  "copa argentina": { id: 130 },
  "brasileirao": { id: 71 }, "liga brasilena": { id: 71 }, "serie a brasil": { id: 71 },
  "liga colombiana": { id: 239 }, "liga betplay": { id: 239 },
  "liga mx": { id: 262 }, "liga mexicana": { id: 262 },
  "copa libertadores": { id: 13, season: 2025 }, "libertadores": { id: 13, season: 2025 },
  "sudamericana": { id: 11, season: 2025 },
  // International
  "copa america": { id: 9 }, "eurocopa": { id: 4 },
  "mundial": { id: 1, season: 2026 }, "world cup": { id: 1, season: 2026 },
  // MLS
  "mls": { id: 253 },
};

// ── Entity extraction ────────────────────────────────────────────────────────

function extractEntitiesFromText(normalized: string): ResolvedEntities {
  const entities: ResolvedEntities = {};

  // Resolve teams from aliases
  const matchedTeamIds: number[] = [];
  for (const [alias, teamId] of Object.entries(TEAM_ALIASES)) {
    if (normalized.includes(alias)) {
      matchedTeamIds.push(teamId);
    }
  }
  if (matchedTeamIds.length > 0) {
    // Deduplicate
    entities.teamIds = [...new Set(matchedTeamIds)];
  }

  // Resolve league (season only set if explicitly overridden; otherwise currentSeason() handles it)
  for (const [alias, league] of Object.entries(LEAGUE_ALIASES)) {
    if (normalized.includes(alias)) {
      entities.leagueId = league.id;
      if (league.season !== undefined) {
        entities.season = league.season;
      }
      break;
    }
  }

  // Resolve date keywords
  const today = new Date().toISOString().slice(0, 10);
  if (/\b(hoy|esta noche|ahora)\b/.test(normalized)) {
    entities.date = today;
  } else if (/\b(ayer)\b/.test(normalized)) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    entities.date = yesterday;
  } else if (/\b(manana)\b/.test(normalized)) {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    entities.date = tomorrow;
  }

  return entities;
}

/** Resolve anaphora: if no explicit entities, inherit from last turn. */
function resolveAnaphora(
  entities: ResolvedEntities,
  history: ConversationTurn[]
): ResolvedEntities {
  if (history.length === 0) return entities;

  // Find last turn with entities
  const lastWithEntities = [...history]
    .reverse()
    .find((t) => t.entities && Object.keys(t.entities).length > 0);
  if (!lastWithEntities?.entities) return entities;

  const prev = lastWithEntities.entities;

  return {
    teamIds: entities.teamIds?.length ? entities.teamIds : prev.teamIds,
    leagueId: entities.leagueId ?? prev.leagueId,
    season: entities.season ?? prev.season,
    fixtureId: entities.fixtureId ?? prev.fixtureId,
    playerName: entities.playerName ?? prev.playerName,
    date: entities.date ?? prev.date,
  };
}

// ── Fixture resolution ───────────────────────────────────────────────────────

async function resolveFixture(entities: ResolvedEntities): Promise<number | null> {
  if (entities.fixtureId) return entities.fixtureId;
  if (!entities.teamIds?.length) return null;

  const teamId = entities.teamIds[0];
  const date = entities.date ?? new Date().toISOString().slice(0, 10);

  try {
    const res = await footballService.getFixtures({ team: teamId, date });
    const fixtures = res.response ?? [];
    if (fixtures.length > 0) {
      return fixtures[0].fixture.id;
    }

    // Try next 3 days for upcoming matches
    const next = await footballService.getFixtures({ team: teamId, next: 1 });
    const nextFixtures = next.response ?? [];
    if (nextFixtures.length > 0) {
      return nextFixtures[0].fixture.id;
    }
  } catch {
    // Silently fail — fixture resolution is best-effort
  }

  return null;
}

// ── Main classifier ──────────────────────────────────────────────────────────

export async function classifyIntent(
  message: string,
  history: ConversationTurn[]
): Promise<ClassifiedIntent> {
  const normalized = normalize(message);
  const rawEntities = extractEntitiesFromText(normalized);
  const entities = resolveAnaphora(rawEntities, history);

  // Try each intent in priority order
  for (const intentId of INTENT_PRIORITY) {
    if (intentId === "GENERAL") continue; // fallback

    const meta = INTENT_META[intentId];
    const matched = meta.patterns.some((p) => p.test(normalized));
    if (!matched) continue;

    // Check entity requirements
    if (meta.requiresTeam && !entities.teamIds?.length) continue;
    if (meta.requiresLeague && !entities.leagueId) continue;

    // Resolve fixture if needed
    if (meta.requiresFixture && !entities.fixtureId) {
      entities.fixtureId = (await resolveFixture(entities)) ?? undefined;
    }

    return { intent: intentId, confidence: 0.85, entities, rawQuery: message };
  }

  // If we have a team but no intent pattern matched, infer TEAM_FORM
  if (entities.teamIds?.length) {
    return { intent: "TEAM_FORM", confidence: 0.5, entities, rawQuery: message };
  }

  // If we have a league: decide between MATCH_DAY and STANDINGS based on context
  if (entities.leagueId) {
    const wantsResults = /\b(hoy|ayer|manana|jornada|fecha|partidos|resultados|que paso|que hay)\b/.test(normalized);
    if (wantsResults || entities.date) {
      return { intent: "MATCH_DAY", confidence: 0.6, entities, rawQuery: message };
    }
    return { intent: "STANDINGS", confidence: 0.5, entities, rawQuery: message };
  }

  return { intent: "GENERAL", confidence: 0.3, entities, rawQuery: message };
}
