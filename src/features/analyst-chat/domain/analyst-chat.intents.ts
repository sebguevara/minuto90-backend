import type { AnalystChatIntent } from "./analyst-chat.types";

// ── Intent metadata ──────────────────────────────────────────────────────────

type IntentMeta = {
  /** Human-readable label for logging / debugging */
  label: string;
  /** Regex patterns that trigger this intent (tested against normalized input) */
  patterns: RegExp[];
  /** Whether this intent requires a resolved team */
  requiresTeam: boolean;
  /** Whether this intent requires a resolved league */
  requiresLeague: boolean;
  /** Whether this intent relates to a specific fixture (live / result) */
  requiresFixture: boolean;
};

export const INTENT_META: Record<AnalystChatIntent, IntentMeta> = {
  MATCH_LIVE: {
    label: "Partido en vivo",
    patterns: [
      /\b(en vivo|como va|va el partido|resultado actual|que pasa en el|marcador actual)\b/,
      /\b(esta ganando|esta perdiendo|van ganando|van perdiendo|como estan jugando)\b/,
    ],
    requiresTeam: true,
    requiresLeague: false,
    requiresFixture: true,
  },
  MATCH_RESULT: {
    label: "Resultado de partido",
    patterns: [
      /\b(como quedo|como termino|resultado de|que paso en|como salio)\b/,
      /\b(quien gano ayer|quien gano el|resultados de ayer|resultado del)\b/,
    ],
    requiresTeam: true,
    requiresLeague: false,
    requiresFixture: true,
  },
  MATCH_PREVIEW: {
    label: "Previa de partido",
    patterns: [
      /\b(preview|previa|analisis previo|como sera|como va a ser)\b/,
      /\b(proximo partido|partido de hoy|juegan hoy|se enfrentan)\b/,
    ],
    requiresTeam: true,
    requiresLeague: false,
    requiresFixture: true,
  },
  PREDICTIONS: {
    label: "Prediccion",
    patterns: [
      /\b(pronostico|prediccion|quien gana|quien va a ganar|apuesta|cuotas)\b/,
      /\b(favorito|chances de|probabilidad)\b/,
    ],
    requiresTeam: true,
    requiresLeague: false,
    requiresFixture: true,
  },
  STANDINGS: {
    label: "Tabla de posiciones",
    patterns: [
      /\b(tabla|posiciones|clasificacion|puestos|lider|colero|zona de descenso)\b/,
      /\b(como esta la tabla|que puesto|cuantos puntos tiene)\b/,
    ],
    requiresTeam: false,
    requiresLeague: true,
    requiresFixture: false,
  },
  TEAM_FORM: {
    label: "Forma del equipo",
    patterns: [
      /\b(racha de|como viene|forma de|forma reciente|ultimos partidos)\b/,
      /\b(viene bien|viene mal|en que racha|momento actual)\b/,
    ],
    requiresTeam: true,
    requiresLeague: false,
    requiresFixture: false,
  },
  TEAM_STATS: {
    label: "Estadisticas de equipo",
    patterns: [
      /\b(estadisticas? de|stats? de|numeros de|rendimiento de)\b/,
      /\b(goles del|posesion del|tarjetas del|corners del)\b/,
    ],
    requiresTeam: true,
    requiresLeague: false,
    requiresFixture: false,
  },
  PLAYER_STATS: {
    label: "Estadisticas de jugador",
    patterns: [
      /\b(goles de|asistencias de|estadisticas de)\b.*\b(jugador|delantero|mediocampista|defensa|portero)\b/,
      /\b(cuantos goles lleva|cuantas asistencias|mejor jugador)\b/,
    ],
    requiresTeam: false,
    requiresLeague: false,
    requiresFixture: false,
  },
  HEAD_TO_HEAD: {
    label: "Historial directo",
    patterns: [
      /\b(historial|h2h|enfrentamientos|historial directo|cuantas veces)\b/,
      /\b(contra|versus|vs\.?)\b/,
    ],
    requiresTeam: true,
    requiresLeague: false,
    requiresFixture: false,
  },
  TOP_SCORERS: {
    label: "Goleadores",
    patterns: [
      /\b(goleadores|maximo goleador|tabla de goles|pichichi|bota de oro)\b/,
      /\b(quien lleva mas goles|top goleadores|maximos anotadores)\b/,
    ],
    requiresTeam: false,
    requiresLeague: true,
    requiresFixture: false,
  },
  INJURIES: {
    label: "Lesionados",
    patterns: [
      /\b(lesionados|bajas|lesiones de|quien esta lesionado|no puede jugar)\b/,
      /\b(convocatoria|disponibles|ausencias)\b/,
    ],
    requiresTeam: true,
    requiresLeague: false,
    requiresFixture: false,
  },
  TRANSFERS: {
    label: "Fichajes",
    patterns: [
      /\b(fichajes|traspasos|mercado|contrato|refuerzos|altas y bajas)\b/,
      /\b(quien ficho|nuevo jugador|se fue de|llego a)\b/,
    ],
    requiresTeam: true,
    requiresLeague: false,
    requiresFixture: false,
  },
  GENERAL: {
    label: "General",
    patterns: [], // fallback, no patterns
    requiresTeam: false,
    requiresLeague: false,
    requiresFixture: false,
  },
};

/** Ordered list of intents for pattern matching (higher priority first). */
export const INTENT_PRIORITY: AnalystChatIntent[] = [
  "MATCH_LIVE",
  "MATCH_RESULT",
  "MATCH_PREVIEW",
  "PREDICTIONS",
  "STANDINGS",
  "TEAM_FORM",
  "TEAM_STATS",
  "PLAYER_STATS",
  "HEAD_TO_HEAD",
  "TOP_SCORERS",
  "INJURIES",
  "TRANSFERS",
  "GENERAL",
];
