import { openai } from "../infrastructure/openai.client";
import { redisConnection } from "../../../shared/redis/redis.connection";
import { logWarn } from "../../../shared/logging/logger";
import type { MomentumSignal, MomentumNarrative } from "./momentum.types";

const CACHE_TTL_SECONDS = 180; // 3 minutes

function buildCacheKey(signal: MomentumSignal): string {
  const env = process.env.NODE_ENV ?? "development";
  const minuteBucket = Math.floor(signal.minute / 3) * 3;
  return `minuto90:${env}:insights:momentum:${signal.fixtureId}:${signal.signalType}:${signal.team}:${minuteBucket}:v1`;
}

const SIGNAL_LABELS: Record<string, string> = {
  shot_pressure: "Presión de tiros",
  possession_swing: "Cambio de posesión",
  corner_cluster: "Ráfaga de corners",
  defensive_collapse: "Colapso defensivo",
  xg_surge: "Peligro real (xG)",
  discipline_risk: "Riesgo disciplinario",
};

const SIGNAL_EMOJIS: Record<string, string> = {
  shot_pressure: "🎯",
  possession_swing: "🔄",
  corner_cluster: "🚩",
  defensive_collapse: "🛡️",
  xg_surge: "⚡",
  discipline_risk: "🟨",
};

async function withRetry<T>(fn: () => Promise<T>, retries = 1, delayMs = 500): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error("unreachable");
}

export async function generateMomentumNarrative(
  signal: MomentumSignal
): Promise<MomentumNarrative> {
  const cacheKey = buildCacheKey(signal);

  try {
    const cached = await redisConnection.get(cacheKey);
    if (cached) return JSON.parse(cached) as MomentumNarrative;
  } catch {}

  const teamName = signal.team === "home" ? signal.homeTeam : signal.awayTeam;
  const opponentName = signal.team === "home" ? signal.awayTeam : signal.homeTeam;
  const probText = signal.probability
    ? `La probabilidad estimada es del ${Math.round(signal.probability)}%.`
    : "";

  const systemPrompt = `Eres un analista deportivo experto en fútbol. Generas insights breves y precisos sobre el momentum de un partido EN VIVO.

Reglas:
- Escribe en español, tono profesional pero accesible.
- Máximo 2 oraciones. Sé directo y concreto.
- Usa los datos proporcionados, NO inventes estadísticas.
- Si hay una probabilidad, intégrala naturalmente en el texto.
- NO uses emojis, encabezados, ni formato markdown.
- Enfócate en qué significa tácticamente lo que está pasando.`;

  const userPrompt = `Partido: ${signal.homeTeam} vs ${signal.awayTeam}, minuto ${signal.minute}.
Señal detectada: ${SIGNAL_LABELS[signal.signalType] ?? signal.signalType} del equipo ${teamName}.
Estadísticas actuales: ${JSON.stringify(signal.stats)}
Cambios recientes: ${JSON.stringify(signal.delta)}
${probText}

Genera un insight breve sobre este momentum.`;

  const completion = await withRetry(() =>
    openai.responses.create({
      model: "gpt-4o-mini",
      instructions: systemPrompt,
      input: userPrompt,
    })
  );

  const narrative = completion.output_text?.trim() || "Momentum significativo detectado en el partido.";
  const cardTitle = SIGNAL_LABELS[signal.signalType] ?? "Momentum";
  const emoji = SIGNAL_EMOJIS[signal.signalType] ?? "📊";

  const result: MomentumNarrative = { narrative, cardTitle, emoji };

  try {
    await redisConnection.set(cacheKey, JSON.stringify(result), "EX", CACHE_TTL_SECONDS);
  } catch (err) {
    logWarn("momentum.cache.set_failed", {
      cacheKey,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return result;
}
