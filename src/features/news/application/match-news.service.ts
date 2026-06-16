/**
 * AI post-match news generator.
 *
 * Given a finished fixture from a featured competition, gathers all match data +
 * tournament context, asks the model for a structured journalistic article
 * (title / bajada / HTML body / hashtags), and publishes it immediately (visible,
 * authored by "minuto90", with an EMPTY image) while firing a web-push to all
 * subscribers. The minuto90 team adds the image afterwards by editing the note
 * (no second push: pushSentAt is already set).
 */
import { footballService } from "../../sports/application/football.service";
import type { ApiFootballFixtureItem } from "../../sports/domain/football.types";
import { openai } from "../../insights/infrastructure/openai.client";
import { isFeaturedCompetitionId } from "../../insights/infrastructure/featured-competition-priority";
import { logError, logInfo, logWarn } from "../../../shared/logging/logger";
import {
  POSTMATCH_NEWS_AUTHOR,
  POSTMATCH_NEWS_MODEL,
  getPostMatchNewsCategoryName,
  getPostMatchNewsCategorySlug,
} from "../../../shared/config/postmatch-news";
import { newsService } from "./news.service";
import { categoryService } from "./category.service";
import { tagService } from "./tag.service";
import { pushService } from "../../push/application/push.service";
import { buildPostMatchContext, type PostMatchContext } from "./match-report-context";
import {
  buildMatchNewsSlug,
  parseMatchNewsDraft,
  sanitizeNewsHtml,
  slugify,
  type TournamentPhase,
} from "./match-news.logic";

const COMPLETED_MATCH_STATUS = new Set(["FT", "AET", "PEN"]);
const WORLD_CUP_LEAGUE_ID = 1;

export type GenerateMatchNewsResult =
  | { status: "created"; newsId: string; slug: string }
  | { status: "exists"; newsId: string; slug: string }
  | { status: "skipped"; reason: string };

async function withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 600): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error("unreachable");
}

function phaseInstruction(phase: TournamentPhase): string {
  switch (phase) {
    case "league":
      return `FASE: LIGA (todos contra todos). En el desarrollo y sobre todo en el cierre, ubicá a los equipos en la tabla usando "tournamentContext.standings" (posición, puntos, zona/description). Explicá qué significa este resultado para la pelea por el título, los puestos de copa o la lucha por no descender.`;
    case "group":
      return `FASE: FASE DE GRUPOS. Usá "tournamentContext.groupName" y "tournamentContext.groupTable" para describir cómo queda el grupo: posiciones, puntos y escenario de clasificación. Aclará quién depende de sí mismo, quién quedó complicado y qué necesita cada uno en lo que resta.`;
    case "knockout":
      return `FASE: ELIMINATORIA. Usá "tournamentContext.knockout". Si "isSecondLeg" es true, calculá el GLOBAL sumando la ida ("firstLegScore") con este resultado y decí con claridad quién avanza y quién queda eliminado; nunca digas "habrá que esperar la vuelta", este ES el partido de vuelta. Si "isFirstLeg" es true, es la IDA: contá la ventaja que se llevó cada uno para la revancha. Si "decidedByExtraTime" o "decidedByPenalties" son true, narralo (tiempo extra / definición por penales).`;
    default:
      return `FASE: PARTIDO ÚNICO. Centrate en lo que dejó el partido en sí.`;
  }
}

function buildSystemPrompt(phase: TournamentPhase): string {
  return `Sos un periodista deportivo de Minuto90 (medio argentino). Escribís la CRÓNICA POST-PARTIDO como una noticia real: cercana, humana, con personalidad, pero rigurosa. El partido YA TERMINÓ: todo en tiempo pasado, análisis retrospectivo.

${phaseInstruction(phase)}

Devolvé EXCLUSIVAMENTE un JSON válido (sin markdown, sin texto fuera del JSON) con esta forma EXACTA:
{"title": string, "summary": string, "bodyHtml": string, "hashtags": string[]}

- "title": titular de noticia, en español, con gancho. Sin comillas internas, máximo ~90 caracteres.
- "summary": la bajada/copete de la noticia: 1 o 2 oraciones que resuman lo más importante. Máximo 280 caracteres.
- "bodyHtml": el cuerpo de la noticia en HTML, estructurado como una nota periodística:
    • Un PREÁMBULO (primer <p>): la entradilla que engancha y cuenta lo esencial (qué pasó, resultado, contexto).
    • DESARROLLO con 2 o 3 subtítulos <h2> o <h3> que ordenen la nota (p. ej. el relato del partido, el análisis táctico, las figuras, lo que significa en el torneo). Bajo cada subtítulo, párrafos <p> cortos.
    • Integrá las estadísticas dentro de la narrativa (posesión, remates, pases clave, ratings) — nunca como lista cruda de números.
    • Si "statsByHalf" está en los datos, comparÁ primer y segundo tiempo (quién dominó cada tramo).
    • Mencioná a las figuras con datos concretos (goles, asistencias, rating) contado como historia.
    • Un CIERRE con lo que se lleva cada equipo y qué significa el resultado en el torneo (según la FASE).
    • Podés usar <strong> y <em> para destacar, y <blockquote> para una frase fuerte. Listas <ul>/<li> solo si aportan.
    • TAGS HTML PERMITIDOS, ÚNICAMENTE: <p>, <h2>, <h3>, <h4>, <strong>, <em>, <ul>, <ol>, <li>, <blockquote>, <a>, <br>, <hr>. Nada de <img>, <script>, <style>, <iframe> ni atributos de estilo.
- "hashtags": exactamente 5 etiquetas en español, cortas (1-3 palabras), SIN el símbolo #, sin duplicados (ej: equipos, competición, jugador destacado, temática).

REGLAS:
- Idioma español rioplatense, tono cercano y profesional. Párrafos cortos (3-4 oraciones).
- NO inventes datos: usá solo lo que está en el input. Si falta un dato, no lo menciones.
- NO hables en futuro sobre el resultado del partido (ya terminó). Nada de "habrá que ver".
- NO menciones cuotas de apuestas ni casas de apuestas.
- El autor es Minuto90; no firmes ni te despidas dentro del cuerpo.`;
}

async function resolveTagIds(hashtags: string[]): Promise<string[]> {
  const ids: string[] = [];
  const seenSlugs = new Set<string>();
  for (const raw of hashtags.slice(0, 5)) {
    const name = raw.replace(/^#+/, "").trim();
    if (!name) continue;
    const slug = slugify(name);
    if (!slug || seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);
    try {
      const tag = await tagService.findOrCreate({ name, slug });
      if (tag?.id && !ids.includes(tag.id)) ids.push(tag.id);
    } catch (err: any) {
      logWarn("postmatch_news.tag.skip", { name, err: err?.message ?? String(err) });
    }
  }
  return ids;
}

async function callModel(context: PostMatchContext): Promise<string> {
  const phase = (context.tournamentContext as { phase?: TournamentPhase }).phase ?? "single";
  const completion = await withRetry(() =>
    openai.responses.create({
      model: POSTMATCH_NEWS_MODEL,
      reasoning: { effort: "low" },
      instructions: buildSystemPrompt(phase),
      input: `Datos del partido finalizado:\n\n${JSON.stringify(context, null, 2)}`,
    })
  );
  return completion.output_text?.trim() ?? "";
}

export type MatchNewsPreview = {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  finalScore: string;
  tournament: string;
  round: string;
  phase: string;
  title: string;
  summary: string;
  bodyHtml: string;
  hashtags: string[];
};

/**
 * DRY-RUN: builds the full context + generates the article with the model, but does
 * NOT persist anything (no DB / no category / no tags / no push). Used to preview how
 * a given fixture would be written up.
 */
export async function previewMatchNewsDraft(
  fixtureId: number
): Promise<{ status: "ok"; preview: MatchNewsPreview } | { status: "skipped"; reason: string; raw?: string }> {
  const fixturesRes = await footballService.getFixtures({ id: fixtureId });
  const fixtureData: ApiFootballFixtureItem | undefined = fixturesRes.response?.[0];
  if (!fixtureData) return { status: "skipped", reason: "fixture_not_found" };

  const context = await buildPostMatchContext(fixtureId, fixtureData);
  const raw = await callModel(context);
  const draft = parseMatchNewsDraft(raw);
  if (!draft) return { status: "skipped", reason: "ai_parse_failed", raw };

  const bodyHtml = sanitizeNewsHtml(draft.bodyHtml);
  return {
    status: "ok",
    preview: {
      fixtureId,
      homeTeam: fixtureData.teams.home.name,
      awayTeam: fixtureData.teams.away.name,
      finalScore: `${fixtureData.goals.home} - ${fixtureData.goals.away}`,
      tournament: fixtureData.league.name,
      round: fixtureData.league.round,
      phase: String((context.tournamentContext as { phase?: string }).phase ?? "single"),
      title: draft.title,
      summary: draft.summary,
      bodyHtml,
      hashtags: draft.hashtags,
    },
  };
}

/**
 * Generates (or returns the existing) AI post-match news draft for a fixture.
 * Idempotent via News.sourceFixtureId (@unique). Never throws on expected skips.
 */
export async function generateMatchNewsDraft(
  fixtureId: number,
  opts: { force?: boolean } = {}
): Promise<GenerateMatchNewsResult> {
  // 1. Idempotency
  const existing = await newsService.getBySourceFixtureId(fixtureId);
  if (existing && !opts.force) {
    return { status: "exists", newsId: existing.id, slug: existing.slug };
  }

  // 2. Load fixture
  const fixturesRes = await footballService.getFixtures({ id: fixtureId });
  const fixtureData: ApiFootballFixtureItem | undefined = fixturesRes.response?.[0];
  if (!fixtureData) {
    return { status: "skipped", reason: "fixture_not_found" };
  }

  // 3. Must be finished
  const statusShort = fixtureData.fixture.status.short?.toUpperCase() ?? "";
  if (!COMPLETED_MATCH_STATUS.has(statusShort)) {
    return { status: "skipped", reason: `not_finished:${statusShort}` };
  }
  if (fixtureData.goals.home === null || fixtureData.goals.away === null) {
    return { status: "skipped", reason: "no_score" };
  }

  // 4. Featured competitions only (manual `force` bypasses this gate)
  const leagueId = fixtureData.league.id;
  if (!opts.force && !isFeaturedCompetitionId(leagueId)) {
    return { status: "skipped", reason: `not_featured:${leagueId}` };
  }

  // 5. Gather context + 6. generate
  const context = await buildPostMatchContext(fixtureId, fixtureData);
  const raw = await callModel(context);
  const draft = parseMatchNewsDraft(raw);
  if (!draft) {
    logWarn("postmatch_news.parse_failed", { fixtureId, rawPreview: raw.slice(0, 200) });
    return { status: "skipped", reason: "ai_parse_failed" };
  }

  const bodyHtml = sanitizeNewsHtml(draft.bodyHtml);
  if (!bodyHtml) {
    return { status: "skipped", reason: "empty_body_after_sanitize" };
  }

  // 7. Category + 8. tags
  const category = await categoryService.findOrCreate({
    name: getPostMatchNewsCategoryName(),
    slug: getPostMatchNewsCategorySlug(),
  });
  const tagIds = await resolveTagIds(draft.hashtags);

  // 9. Persist as hidden draft
  const slug = buildMatchNewsSlug(draft.title, fixtureId);
  try {
    const news = await newsService.create({
      title: draft.title,
      slug,
      summary: draft.summary ? draft.summary.slice(0, 300) : null,
      body: bodyHtml,
      imageUrl: null,
      authorName: POSTMATCH_NEWS_AUTHOR,
      featured: false,
      // Visible al instante (sin imagen): el equipo la agrega después editando.
      isHidden: false,
      isMundial: leagueId === WORLD_CUP_LEAGUE_ID,
      isAiGenerated: true,
      sourceFixtureId: fixtureId,
      publishedAt: new Date(),
      categoryId: category.id,
      tagIds,
    });

    logInfo("postmatch_news.created", {
      fixtureId,
      newsId: news.id,
      slug: news.slug,
      league: leagueId,
      phase: (context.tournamentContext as { phase?: string }).phase ?? null,
      tags: tagIds.length,
    });

    // Push inmediato a los suscriptores. Si falla, no rompe el job: el poller de
    // publicación (cada 1 min) reintenta mientras pushSentAt siga en null.
    try {
      const pushResult = await pushService.enqueueNewsPublicationPush(news.id);
      logInfo("postmatch_news.push_enqueued", {
        newsId: news.id,
        status: pushResult.status,
        jobs: pushResult.jobs,
      });
    } catch (pushErr: any) {
      logWarn("postmatch_news.push_enqueue_failed", {
        newsId: news.id,
        err: pushErr?.message ?? String(pushErr),
      });
    }

    return { status: "created", newsId: news.id, slug: news.slug };
  } catch (err: any) {
    // Race on @unique sourceFixtureId/slug: another worker already created it.
    if (err?.code === "P2002") {
      const again = await newsService.getBySourceFixtureId(fixtureId);
      if (again) return { status: "exists", newsId: again.id, slug: again.slug };
    }
    logError("postmatch_news.create_failed", { fixtureId, err: err?.message ?? String(err) });
    throw err;
  }
}
