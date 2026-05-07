import type {
  ApiFootballFixtureEvent,
  ApiFootballLiveFixture,
} from "../infrastructure/api-football-live.client";
import { templates } from "./templates";
import { buildMatchUrl } from "./match-url";

export type DiffTriggerType =
  | "KICKOFF"
  | "GOAL"
  | "PENALTY_SHOOTOUT_START"
  | "PENALTY_SHOOTOUT_KICK"
  | "VAR_CANCELLED"
  | "RED_CARD"
  | "HALFTIME"
  | "SECOND_HALF"
  | "FULL_TIME"
  | "FULL_TIME_DISAPPEARED";

export type DiffTrigger = {
  fixtureId: number;
  type: DiffTriggerType;
  message: string;
  eventKey: string;
  /** Only set for GOAL triggers: score at the moment the goal was detected.
   *  The WhatsApp worker uses this to skip messages when the score was corrected
   *  downward (e.g. by VAR) before the message was delivered. */
  scoreHome?: number;
  scoreAway?: number;
};

export type StoredMatchState = {
  fixtureId: number;
  statusShort: string | null;
  goalsHome: number;
  goalsAway: number;
  redCards: number;
  eventKeys: string[];
  fixture: ApiFootballLiveFixture;
  updatedAtMs: number;
  /** Cuenta acumulada de goles "phantom" emitidos por lado (gol notificado sin que la API
   *  haya publicado el evento todavía). Se usa para suprimir notificaciones retroactivas
   *  cuando el evento real aparece tarde y el marcador ya estaba reflejado. */
  phantomGoalsHome?: number;
  phantomGoalsAway?: number;
};

const terminalStatuses = new Set(["FT", "AET", "PEN"]);
const breakStatuses = new Set(["HT", "BT", "INT"]);

function asScore(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getTeamNames(fixture: ApiFootballLiveFixture) {
  const homeTeam = fixture.teams?.home?.name ?? "Home";
  const awayTeam = fixture.teams?.away?.name ?? "Away";
  const leagueName = fixture.league?.name ?? "League";
  return { homeTeam, awayTeam, leagueName };
}

/**
 * Identidad del evento para diff/dedup: sin `comments` (API-Football suele agregarlo después
 * y eso cambiaba la clave → mismo gol/tarjeta/etc. disparaba notificaciones duplicadas).
 */
export function buildEventKey(event: ApiFootballFixtureEvent): string {
  const elapsed = event?.time?.elapsed ?? "";
  const extra = event?.time?.extra ?? "";
  const team = event?.team?.id ?? event?.team?.name ?? "";
  const player = event?.player?.id ?? event?.player?.name ?? "";
  const type = event?.type ?? "";
  const detail = event?.detail ?? "";
  return [type, detail, team, player, elapsed, extra].join("|");
}

/** Formato anterior (incluía comments); sirve para no re-notificar eventos ya guardados en Redis. */
function buildEventKeyLegacy(event: ApiFootballFixtureEvent): string {
  const comments = event?.comments ?? "";
  return `${buildEventKey(event)}|${comments}`;
}

function isEventAlreadyKnown(oldSet: Set<string>, event: ApiFootballFixtureEvent): boolean {
  if (oldSet.has(buildEventKey(event))) return true;
  return oldSet.has(buildEventKeyLegacy(event));
}

/** Key sin player para shootout kicks: evita duplicados cuando la API agrega el nombre después. */
function buildShootoutKickKey(event: ApiFootballFixtureEvent): string {
  const elapsed = event?.time?.elapsed ?? "";
  const extra = event?.time?.extra ?? "";
  const team = event?.team?.id ?? event?.team?.name ?? "";
  const type = event?.type ?? "";
  const detail = event?.detail ?? "";
  return [type, detail, team, elapsed, extra].join("|");
}

function buildEventKeys(events: ApiFootballFixtureEvent[] | undefined): string[] {
  if (!events?.length) return [];
  const keys: string[] = [];
  for (const e of events) {
    if (!e) continue;
    keys.push(buildEventKey(e));
  }
  return keys;
}

function countRedCards(events: ApiFootballFixtureEvent[] | undefined): number {
  if (!events?.length) return 0;
  let count = 0;
  for (const e of events) {
    if (e?.type === "Card" && e?.detail === "Red Card") count++;
  }
  return count;
}

function minuteFromEvent(e: ApiFootballFixtureEvent | null): number | string {
  const m = e?.time?.elapsed;
  return typeof m === "number" && Number.isFinite(m) ? m : "?";
}

/**
 * Firma del gol con jugador (sin minuto/extra). Permite distinguir dos goles del mismo equipo
 * por jugadores distintos, y diferencia un evento sin scorer (`detail|team|`) del mismo gol con
 * scorer publicado después (`detail|team|Cavani`) — el segundo cuenta como nuevo y se notifica
 * con el nombre del scorer. Sigue siendo estable ante correcciones de minuto.
 */
function goalSignature(e: ApiFootballFixtureEvent): string {
  const team = e?.team?.id ?? e?.team?.name ?? "";
  const detail = e?.detail ?? "";
  const player = e?.player?.id ?? e?.player?.name ?? "";
  return `${detail}|${team}|${player}`;
}

/** Firma agnóstica al scorer: usada para detectar player-fillin y para contar "raw events" por lado. */
function goalSignatureNoPlayer(e: ApiFootballFixtureEvent): string {
  const team = e?.team?.id ?? e?.team?.name ?? "";
  const detail = e?.detail ?? "";
  return `${detail}|${team}`;
}

function hasScorer(e: ApiFootballFixtureEvent): boolean {
  return Boolean(e?.player?.name && String(e.player.name).trim().length);
}

/**
 * Gol con plantilla "Gol" normal: excluye `Missed Penalty` siempre.
 * Los penales convertidos *durante el juego normal* (detail=`Penalty`, status≠`P`) sí se
 * notifican como gol; solo se excluyen durante la tanda (`P`), donde van por PENALTY_SHOOTOUT_KICK.
 * `inShootout` true = estamos en estado `P`, por lo que penales van por otra rama.
 */
function isRegularPlayMatchGoalForNotification(
  event: ApiFootballFixtureEvent | null | undefined,
  inShootout: boolean = false
): boolean {
  if (!event || event.type !== "Goal") return false;
  const detail = (event.detail ?? "").trim();
  if (detail === "Missed Penalty") return false;
  // Durante tanda (status P): los penales van por PENALTY_SHOOTOUT_KICK, no por GOAL.
  if (detail === "Penalty" && inShootout) return false;
  return true;
}

function countSignatureRegularMatchGoals(
  events: ApiFootballFixtureEvent[] | undefined,
  sig: string,
  inShootout: boolean = false
): number {
  if (!events?.length) return 0;
  let n = 0;
  for (const e of events) {
    // Solo contamos goles con scorer ya publicado: si en old hubo un evento sin player,
    // no debe bloquear la notificación de la misma transición cuando el scorer aparezca.
    if (
      isRegularPlayMatchGoalForNotification(e, inShootout) &&
      hasScorer(e) &&
      goalSignature(e) === sig
    ) {
      n++;
    }
  }
  return n;
}

/** Cuenta eventos de gol nuevos para un lado (sin filtrar por scorer): sirve para distinguir
 *  "hueco real" (la API no publicó nada) de "evento publicado pero sin nombre todavía". */
function countRawNewGoalEventsForSide(
  oldEvents: ApiFootballFixtureEvent[] | undefined,
  newEvents: ApiFootballFixtureEvent[],
  side: "home" | "away",
  fixture: ApiFootballLiveFixture,
  inShootout: boolean
): number {
  const oldSigCounts = new Map<string, number>();
  for (const e of oldEvents ?? []) {
    if (!isRegularPlayMatchGoalForNotification(e, inShootout)) continue;
    if (resolveEventTeamSide(e, fixture) !== side) continue;
    const k = goalSignatureNoPlayer(e);
    oldSigCounts.set(k, (oldSigCounts.get(k) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  let raw = 0;
  for (const e of newEvents) {
    if (!isRegularPlayMatchGoalForNotification(e, inShootout)) continue;
    if (resolveEventTeamSide(e, fixture) !== side) continue;
    const k = goalSignatureNoPlayer(e);
    const nth = (seen.get(k) ?? 0) + 1;
    seen.set(k, nth);
    if (nth > (oldSigCounts.get(k) ?? 0)) raw++;
  }
  return raw;
}

function isShootoutKickEvent(event: ApiFootballFixtureEvent | null | undefined): boolean {
  if (!event || event.type !== "Goal") return false;
  const d = (event.detail ?? "").trim();
  return d === "Penalty" || d === "Missed Penalty";
}

function parsePenaltyShootoutScore(fixture: ApiFootballLiveFixture): { home: number; away: number } | null {
  const score = fixture.score;
  if (!score || typeof score !== "object" || Array.isArray(score)) return null;
  const pen = (score as Record<string, unknown>).penalty;
  if (!pen || typeof pen !== "object" || Array.isArray(pen)) return null;
  const p = pen as Record<string, unknown>;
  const h = Number(p.home);
  const a = Number(p.away);
  if (!Number.isFinite(h) || !Number.isFinite(a)) return null;
  return { home: h, away: a };
}

/**
 * Solo disparar "gol anulado (VAR)" si la API añade un evento explícito (no por una bajada
 * puntual del marcador, que suele ser corrección de datos y no VAR).
 */
function isVarGoalCancellationLikeEvent(event: ApiFootballFixtureEvent | null | undefined): boolean {
  if (!event) return false;
  const type = (event.type ?? "").trim().toLowerCase();
  const detail = (event.detail ?? "").trim().toLowerCase();
  const isVarType = type === "var" || type.includes("video assistant");
  if (
    detail.includes("disallowed") ||
    detail.includes("disallow") ||
    detail.includes("goal cancelled") ||
    detail.includes("goal disallowed") ||
    detail.includes("no goal")
  ) {
    return isVarType || type === "goal";
  }
  if (isVarType && detail.includes("goal") && /cancel|disallow|overturn|revok|annul/i.test(detail)) {
    return true;
  }
  return false;
}

/** Goles nuevos en `newEvents` respetando orden (misma firma: enésima ocurrencia > la que había en old).
 *  Eventos sin scorer se omiten: esperamos a que la API publique el nombre antes de avisar.
 *  Si no hay evento de gol todavía pero el marcador subió, el gol se cubre con un phantom (ver
 *  computeDiffTriggers). */
function collectNewGoalEvents(
  oldEvents: ApiFootballFixtureEvent[] | undefined,
  newEvents: ApiFootballFixtureEvent[],
  inShootout: boolean = false
): Array<{ event: ApiFootballFixtureEvent; nth: number }> {
  const ordered: Array<{ event: ApiFootballFixtureEvent; nth: number }> = [];
  const nthBySig = new Map<string, number>();
  for (const e of newEvents) {
    if (!isRegularPlayMatchGoalForNotification(e, inShootout)) continue;
    if (!hasScorer(e)) continue;
    const sig = goalSignature(e);
    const prevCount = countSignatureRegularMatchGoals(oldEvents, sig, inShootout);
    const nth = (nthBySig.get(sig) ?? 0) + 1;
    nthBySig.set(sig, nth);
    if (nth > prevCount) ordered.push({ event: e, nth });
  }
  return ordered;
}

/** Lanzamientos de la tanda: eventos Goal con detalle Penalty / Missed Penalty solo con estado `P`. */
function collectNewShootoutKickEvents(
  oldEvents: ApiFootballFixtureEvent[] | undefined,
  newEvents: ApiFootballFixtureEvent[],
  newStatus: string | null,
  isColdStart: boolean
): ApiFootballFixtureEvent[] {
  if (isColdStart || newStatus !== "P") return [];
  // Dedup sin player: la API puede mandar el mismo penal primero sin nombre y luego con nombre.
  const oldShootoutKeys = new Set<string>();
  if (oldEvents?.length) {
    for (const e of oldEvents) {
      if (isShootoutKickEvent(e)) oldShootoutKeys.add(buildShootoutKickKey(e));
    }
  }
  const out: ApiFootballFixtureEvent[] = [];
  for (const e of newEvents) {
    if (!isShootoutKickEvent(e)) continue;
    if (oldShootoutKeys.has(buildShootoutKickKey(e))) continue;
    out.push(e);
  }
  return out;
}

function bumpScoreForGoal(
  e: ApiFootballFixtureEvent,
  fixture: ApiFootballLiveFixture,
  rh: number,
  ra: number
): [number, number] {
  const tid = e.team?.id;
  const homeId = fixture.teams?.home?.id;
  const awayId = fixture.teams?.away?.id;
  if (typeof tid === "number" && typeof homeId === "number" && tid === homeId) return [rh + 1, ra];
  if (typeof tid === "number" && typeof awayId === "number" && tid === awayId) return [rh, ra + 1];

  const homeTeam = fixture.teams?.home?.name ?? "";
  const awayTeam = fixture.teams?.away?.name ?? "";
  const t = (e.team?.name ?? "").trim().toLowerCase();
  const h = homeTeam.trim().toLowerCase();
  const a = awayTeam.trim().toLowerCase();
  if (t && h && t === h) return [rh + 1, ra];
  if (t && a && t === a) return [rh, ra + 1];
  return [rh, ra + 1];
}

function scorerFromEvent(e: ApiFootballFixtureEvent | null): string | null {
  return e?.player?.name ?? null;
}

function assistFromEvent(e: ApiFootballFixtureEvent | null): string | null {
  return e?.assist?.name ?? null;
}

function playerNameOrUnknown(e: ApiFootballFixtureEvent | null): string {
  return e?.player?.name ?? "Jugador";
}

function teamFromEvent(e: ApiFootballFixtureEvent | null, fixture: ApiFootballLiveFixture): string {
  return e?.team?.name ?? fixture.teams?.home?.name ?? fixture.teams?.away?.name ?? "Equipo";
}

function resolveEventTeamSide(
  event: ApiFootballFixtureEvent | null | undefined,
  fixture: ApiFootballLiveFixture
): "home" | "away" | null {
  if (!event) return null;

  const teamId = event.team?.id;
  const homeId = fixture.teams?.home?.id;
  const awayId = fixture.teams?.away?.id;

  if (typeof teamId === "number" && typeof homeId === "number" && teamId === homeId) return "home";
  if (typeof teamId === "number" && typeof awayId === "number" && teamId === awayId) return "away";

  const teamName = (event.team?.name ?? "").trim().toLowerCase();
  const homeName = (fixture.teams?.home?.name ?? "").trim().toLowerCase();
  const awayName = (fixture.teams?.away?.name ?? "").trim().toLowerCase();

  if (teamName && homeName && teamName === homeName) return "home";
  if (teamName && awayName && teamName === awayName) return "away";

  return null;
}

function buildVarCancellationEventKey(input: {
  oldScoreHome: number;
  oldScoreAway: number;
  newScoreHome: number;
  newScoreAway: number;
  fixture: ApiFootballLiveFixture;
  event?: ApiFootballFixtureEvent | null;
}): string {
  const sideFromDrop =
    input.oldScoreHome - input.newScoreHome === 1 && input.oldScoreAway === input.newScoreAway
      ? "home"
      : input.oldScoreAway - input.newScoreAway === 1 && input.oldScoreHome === input.newScoreHome
        ? "away"
        : null;
  const side = sideFromDrop ?? resolveEventTeamSide(input.event, input.fixture);

  if (side === "home") {
    return `var_cancelled:home:${input.newScoreHome + 1}-${input.newScoreAway}->${input.newScoreHome}-${input.newScoreAway}`;
  }

  if (side === "away") {
    return `var_cancelled:away:${input.newScoreHome}-${input.newScoreAway + 1}->${input.newScoreHome}-${input.newScoreAway}`;
  }

  return `var_cancelled:unknown:${input.oldScoreHome}-${input.oldScoreAway}->${input.newScoreHome}-${input.newScoreAway}`;
}

export function buildStoredState(newFixture: ApiFootballLiveFixture): StoredMatchState {
  const fixtureId = newFixture.fixture.id;
  const statusShort = newFixture.fixture.status?.short ?? null;
  const goalsHome = asScore(newFixture.goals?.home);
  const goalsAway = asScore(newFixture.goals?.away);
  const redCards = countRedCards(newFixture.events);
  const eventKeys = buildEventKeys(newFixture.events);

  return {
    fixtureId,
    statusShort,
    goalsHome,
    goalsAway,
    redCards,
    eventKeys,
    fixture: newFixture,
    updatedAtMs: Date.now(),
  };
}

export function computeDiffTriggers(oldState: StoredMatchState | null, newFixture: ApiFootballLiveFixture) {
  const fixtureId = newFixture.fixture.id;
  const newStatus = newFixture.fixture.status?.short ?? null;
  const { homeTeam, awayTeam, leagueName } = getTeamNames(newFixture);
  const matchUrl = buildMatchUrl({ fixtureId, leagueName, homeTeam, awayTeam });

  const newScoreHome = asScore(newFixture.goals?.home);
  const newScoreAway = asScore(newFixture.goals?.away);
  const oldStatus = oldState?.statusShort ?? null;
  const oldScoreHome = oldState?.goalsHome ?? 0;
  const oldScoreAway = oldState?.goalsAway ?? 0;
  const oldRedCards = oldState?.redCards ?? 0;
  const newRedCards = countRedCards(newFixture.events);
  const oldEventKeySet = new Set(oldState?.eventKeys ?? buildEventKeys(oldState?.fixture?.events));
  const newEvents = newFixture.events ?? [];

  const triggers: DiffTrigger[] = [];
  // Phantom counters: necesarios después del bloque GOAL para persistirlos en `newState`.
  let phantomGoalsAddedHome = 0;
  let phantomGoalsAddedAway = 0;

  // Cold start baseline: avoid sending historical goals/cards when we have no previous state.
  // We'll still persist state so subsequent polls can diff correctly.
  const isColdStart = oldState === null;

  // KICKOFF
  const elapsed = newFixture.fixture.status?.elapsed ?? null;
  const allowColdKickoff = isColdStart && typeof elapsed === "number" && elapsed <= 2;
  if ((oldStatus === "NS" || oldStatus === null) && newStatus === "1H" && (!isColdStart || allowColdKickoff)) {
    triggers.push({
      fixtureId,
      type: "KICKOFF",
      eventKey: `status:${oldStatus ?? "null"}->${newStatus}`,
      message: templates.kickoff({ homeTeam, awayTeam, leagueName, matchUrl }),
    });
  }

  // VAR_CANCELLED: (1) fila nueva en `events` que indique anulación explícita de la API.
  if (!isColdStart) {
    for (const e of newEvents) {
      if (!isVarGoalCancellationLikeEvent(e)) continue;
      if (isEventAlreadyKnown(oldEventKeySet, e)) continue;
      const k = buildVarCancellationEventKey({
        oldScoreHome,
        oldScoreAway,
        newScoreHome,
        newScoreAway,
        fixture: newFixture,
        event: e,
      });
      triggers.push({
        fixtureId,
        type: "VAR_CANCELLED",
        eventKey: k,
        message: templates.varCancelled({
          homeTeam,
          awayTeam,
          leagueName,
          matchUrl,
          scoreHome: newScoreHome,
          scoreAway: newScoreAway,
        }),
      });
    }
  }

  // VAR_CANCELLED: (2) bajada exacta de 1 gol en el marcador como heurística cuando la API
  // tarda en publicar el evento VAR explícito. Solo se dispara si no hay ya un trigger VAR
  // (para evitar duplicados) y si no es un cold start. Puede generar falsos positivos en
  // correcciones de datos de la API, pero permite notificaciones más rápidas.
  if (!isColdStart) {
    const homeDroppedOne = oldScoreHome - newScoreHome === 1 && newScoreAway === oldScoreAway;
    const awayDroppedOne = oldScoreAway - newScoreAway === 1 && newScoreHome === oldScoreHome;
    const hasVarTriggerAlready = triggers.some((t) => t.type === "VAR_CANCELLED");
    if ((homeDroppedOne || awayDroppedOne) && !hasVarTriggerAlready) {
      triggers.push({
        fixtureId,
        type: "VAR_CANCELLED",
        eventKey: buildVarCancellationEventKey({
          oldScoreHome,
          oldScoreAway,
          newScoreHome,
          newScoreAway,
          fixture: newFixture,
        }),
        message: templates.varCancelled({
          homeTeam,
          awayTeam,
          leagueName,
          matchUrl,
          scoreHome: newScoreHome,
          scoreAway: newScoreAway,
        }),
      });
    }
  }

  // Tanda de penales (estado API `P`): aviso de inicio; los penales no usan plantilla de gol normal.
  if (!isColdStart && newStatus === "P" && oldStatus !== "P") {
    triggers.push({
      fixtureId,
      type: "PENALTY_SHOOTOUT_START",
      eventKey: `status:${oldStatus ?? "null"}->${newStatus}`,
      message: templates.penaltyShootoutStart({
        homeTeam,
        awayTeam,
        leagueName,
        matchUrl,
        scoreHome: newScoreHome,
        scoreAway: newScoreAway,
      }),
    });
  }

  // GOAL: la cantidad de triggers se decide por el delta de marcador (no por la cantidad
  // de eventos nuevos), para no perder goles cuando la API tarda en publicar el evento.
  // Si hay menos eventos que el delta, se generan "phantoms" (sin jugador) para cerrar
  // la diferencia; cuando el evento real aparezca en un poll posterior, el dedup por
  // mensaje (per-suscriptor) evita duplicarlo.
  if (!isColdStart) {
    const homeDelta = newScoreHome - oldScoreHome;
    const awayDelta = newScoreAway - oldScoreAway;
    const netGoalDelta = homeDelta + awayDelta;

    const oldFeed = oldState?.fixture?.events;
    const inShootout = newStatus === "P";
    const collected = collectNewGoalEvents(oldFeed, newEvents, inShootout);

    const collectedHome: Array<{ event: ApiFootballFixtureEvent; nth: number }> = [];
    const collectedAway: Array<{ event: ApiFootballFixtureEvent; nth: number }> = [];
    for (const c of collected) {
      const side = resolveEventTeamSide(c.event, newFixture);
      if (side === "home") collectedHome.push(c);
      else if (side === "away") collectedAway.push(c);
    }

    // Raw count: cuántos eventos nuevos aparecen en el feed por lado (con o sin scorer).
    // Sirve para distinguir "hueco real" (la API no publicó nada todavía → phantom) de
    // "evento publicado sin nombre" (esperar a que llegue el scorer, no phantomear).
    const rawNewHomeCount = countRawNewGoalEventsForSide(oldFeed, newEvents, "home", newFixture, inShootout);
    const rawNewAwayCount = countRawNewGoalEventsForSide(oldFeed, newEvents, "away", newFixture, inShootout);

    type EmitItem = {
      event: ApiFootballFixtureEvent | null;
      nth: number | null;
      side: "home" | "away";
    };
    const emissionQueue: EmitItem[] = [];

    if (netGoalDelta > 0) {
      // Score subió: emitir hasta `delta` triggers por lado, distinguiendo:
      //  - Real: evento con scorer disponible (se incluye en `collected`).
      //  - Phantom: hueco que la API no publicó (delta > rawNewCount); cubrimos el delta
      //    para que el usuario reciba la notificación aunque la API tarde mucho en publicar.
      //  - Espera: hay evento sin scorer (rawNewCount cubre el delta pero no tenemos nombre);
      //    no emitimos phantom — esperamos al próximo poll a que la API rellene el scorer.
      const homeRealCount = Math.max(0, Math.min(homeDelta, collectedHome.length));
      const awayRealCount = Math.max(0, Math.min(awayDelta, collectedAway.length));
      const homeReal = homeRealCount > 0 ? collectedHome.slice(-homeRealCount) : [];
      const awayReal = awayRealCount > 0 ? collectedAway.slice(-awayRealCount) : [];
      const homePhantomCount = Math.max(0, homeDelta - rawNewHomeCount);
      const awayPhantomCount = Math.max(0, awayDelta - rawNewAwayCount);

      if (homeDelta > 0) {
        for (let i = 0; i < homePhantomCount; i++) {
          emissionQueue.push({ event: null, nth: null, side: "home" });
          phantomGoalsAddedHome++;
        }
        for (const r of homeReal) {
          emissionQueue.push({ event: r.event, nth: r.nth, side: "home" });
        }
      }
      if (awayDelta > 0) {
        for (let i = 0; i < awayPhantomCount; i++) {
          emissionQueue.push({ event: null, nth: null, side: "away" });
          phantomGoalsAddedAway++;
        }
        for (const r of awayReal) {
          emissionQueue.push({ event: r.event, nth: r.nth, side: "away" });
        }
      }
    } else if (netGoalDelta === 0 && collected.length === 1) {
      // Score no cambió pero apareció un evento (con scorer):
      //   (a) "Score implied by event": la API publicó el evento antes de actualizar `goals`
      //       → emitimos con bumpScoreForGoal sobre el marcador actual.
      //   (b) "Player fillin": un evento previo sin scorer ahora tiene nombre → emitimos
      //       con el marcador anclado a la API (no bumpeamos porque el score ya estaba bien).
      //   (c) "Retroactivo después de phantom": habíamos emitido un phantom para el lado del
      //       evento; el real llega tarde y bumpear daría un score erróneo → suprimimos.
      const c = collected[0]!;
      const side = resolveEventTeamSide(c.event, newFixture);
      const sig = goalSignature(c.event);
      const prevCountInOld = countSignatureRegularMatchGoals(oldFeed, sig, inShootout);
      const sigNoPlayer = goalSignatureNoPlayer(c.event);
      const isPlayerFillin = (oldFeed ?? []).some(
        (oe) =>
          isRegularPlayMatchGoalForNotification(oe, inShootout) &&
          !hasScorer(oe) &&
          goalSignatureNoPlayer(oe) === sigNoPlayer &&
          resolveEventTeamSide(oe, newFixture) === side
      );
      const phantomEmittedSide =
        side === "home"
          ? oldState?.phantomGoalsHome ?? 0
          : side === "away"
            ? oldState?.phantomGoalsAway ?? 0
            : 0;

      if (prevCountInOld === 0 && side && phantomEmittedSide === 0) {
        emissionQueue.push({ event: c.event, nth: c.nth, side });
      } else if (isPlayerFillin && side) {
        // Caso (b): emitimos con anchor a marcador API (no bump) porque el score ya está bien.
        emissionQueue.push({ event: c.event, nth: c.nth, side });
      }
      // En el caso (c) no agregamos nada: el phantom previo ya cubrió la notificación.
    }

    // Player fillin (else-if): el marcador YA refleja el gol — nos anclamos al snapshot
    // de la API para no inventar un score inflado por bump.
    const isPlayerFillinEmission =
      emissionQueue.length === 1 &&
      netGoalDelta === 0 &&
      emissionQueue[0]!.event != null &&
      (oldFeed ?? []).some(
        (oe) =>
          isRegularPlayMatchGoalForNotification(oe, inShootout) &&
          !hasScorer(oe) &&
          goalSignatureNoPlayer(oe) === goalSignatureNoPlayer(emissionQueue[0]!.event!)
      );

    const useApiSnapshotAnchor =
      (emissionQueue.length === 1 && netGoalDelta === 1) || isPlayerFillinEmission;
    let rh = oldScoreHome;
    let ra = oldScoreAway;

    for (const item of emissionQueue) {
      const event = item.event;
      let bh: number;
      let ba: number;

      if (event && netGoalDelta === 0 && !isPlayerFillinEmission) {
        // Rama "score implied by event": bump por equipo del evento (la API publicó el
        // evento antes que el snapshot de `goals`).
        [bh, ba] = bumpScoreForGoal(event, newFixture, rh, ra);
      } else {
        bh = item.side === "home" ? rh + 1 : rh;
        ba = item.side === "away" ? ra + 1 : ra;
      }

      const nh = useApiSnapshotAnchor ? newScoreHome : bh;
      const na = useApiSnapshotAnchor ? newScoreAway : ba;

      const teamName = event
        ? teamFromEvent(event, newFixture)
        : item.side === "home"
          ? homeTeam
          : awayTeam;
      const playerName = event ? scorerFromEvent(event) : null;
      const assistName = event ? assistFromEvent(event) : null;
      const minute = event ? minuteFromEvent(event) : "?";

      // Real → sig+nth (mantiene la dedup nth>=2 post-VAR del test existente).
      // Phantom → score-anchored: si en el siguiente poll aparece el evento real con otro
      // nth, su eventKey va a diferir y emitirá un mensaje real (mejor que perder el gol).
      const eventKey =
        event && item.nth != null
          ? `goal:${goalSignature(event)}:${item.nth}`
          : `goal:phantom:${item.side}:${item.side === "home" ? bh : ba}`;

      triggers.push({
        fixtureId,
        type: "GOAL",
        eventKey,
        scoreHome: nh,
        scoreAway: na,
        message: templates.goal({
          homeTeam,
          awayTeam,
          leagueName,
          matchUrl,
          scoreHome: nh,
          scoreAway: na,
          teamName,
          playerName,
          assistName,
          minute,
        }),
      });
      rh = bh;
      ra = ba;
    }

    const penScore = parsePenaltyShootoutScore(newFixture);
    const newShootoutKicks = collectNewShootoutKickEvents(oldState?.fixture?.events, newEvents, newStatus, isColdStart);
    for (const e of newShootoutKicks) {
      const detail = (e.detail ?? "").trim();
      const converted = detail !== "Missed Penalty";
      triggers.push({
        fixtureId,
        type: "PENALTY_SHOOTOUT_KICK",
        eventKey: `event:${buildShootoutKickKey(e)}`,
        message: templates.penaltyShootoutKick({
          homeTeam,
          awayTeam,
          leagueName,
          matchUrl,
          teamName: teamFromEvent(e, newFixture),
          converted,
          shootoutHome: penScore?.home ?? null,
          shootoutAway: penScore?.away ?? null,
        }),
      });
    }
  }

  // RED_CARD
  if (!isColdStart) {
    for (const e of newEvents) {
      if (e?.type !== "Card" || e?.detail !== "Red Card") continue;
      const k = buildEventKey(e);
      if (isEventAlreadyKnown(oldEventKeySet, e)) continue;
      triggers.push({
        fixtureId,
        type: "RED_CARD",
        eventKey: `event:${k}`,
        message: templates.redCard({
          homeTeam,
          awayTeam,
          leagueName,
          matchUrl,
          scoreHome: newScoreHome,
          scoreAway: newScoreAway,
          teamName: teamFromEvent(e, newFixture),
          playerName: playerNameOrUnknown(e),
          minute: minuteFromEvent(e),
        }),
      });
    }
  }

  // HALFTIME
  if (!isColdStart && newStatus === "HT" && oldStatus !== "HT") {
    triggers.push({
      fixtureId,
      type: "HALFTIME",
      eventKey: `status:${oldStatus ?? "null"}->${newStatus}`,
      message: templates.halfTime({
        homeTeam,
        awayTeam,
        leagueName,
        matchUrl,
        scoreHome: newScoreHome,
        scoreAway: newScoreAway,
      }),
    });
  }

  // SECOND_HALF
  if (!isColdStart && newStatus === "2H" && oldStatus === "HT") {
    triggers.push({
      fixtureId,
      type: "SECOND_HALF",
      eventKey: `status:${oldStatus}->${newStatus}`,
      message: templates.secondHalf({
        homeTeam,
        awayTeam,
        leagueName,
        matchUrl,
        scoreHome: newScoreHome,
        scoreAway: newScoreAway,
      }),
    });
  }

  // FULL_TIME
  // isLikelyBreak: evita disparar FULL_TIME si venimos de HT/INT (descanso de mitad o prórroga).
  // ⚠️  BT (Break Time durante prórroga) NO se incluye aquí porque es un paso intermedio válido
  //     hacia AET/PEN. Solo HT e INT son descansos que no preceden directamente al final.
  const elapsedForStatus = newFixture.fixture.status?.elapsed ?? null;
  const isLikelyBreak =
    oldStatus === "HT" ||
    oldStatus === "INT" ||
    (oldStatus === "1H" && typeof elapsedForStatus === "number" && elapsedForStatus >= 40 && elapsedForStatus <= 55);
  if (
    !isColdStart &&
    !isLikelyBreak &&
    newStatus &&
    terminalStatuses.has(newStatus) &&
    !terminalStatuses.has(oldStatus ?? "")
  ) {
    triggers.push({
      fixtureId,
      type: "FULL_TIME",
      eventKey: `status:${oldStatus ?? "null"}->${newStatus}`,
      message: templates.fullTime({
        homeTeam,
        awayTeam,
        leagueName,
        matchUrl,
        scoreHome: newScoreHome,
        scoreAway: newScoreAway,
      }),
    });
  }

  const newState = buildStoredState(newFixture);
  // Heredamos los phantom counts y sumamos los emitidos en este poll, para que polls
  // posteriores puedan suprimir notificaciones retroactivas (caso "evento histórico llega
  // tarde después de phantom").
  newState.phantomGoalsHome = (oldState?.phantomGoalsHome ?? 0) + phantomGoalsAddedHome;
  newState.phantomGoalsAway = (oldState?.phantomGoalsAway ?? 0) + phantomGoalsAddedAway;

  const oldEventKeys = oldState?.eventKeys ?? [];
  const newEventKeys = newState.eventKeys ?? [];
  const hasRelevantChanges =
    oldStatus !== newState.statusShort ||
    oldScoreHome !== newState.goalsHome ||
    oldScoreAway !== newState.goalsAway ||
    oldRedCards !== newState.redCards ||
    oldEventKeys.length !== newEventKeys.length ||
    oldEventKeys[oldEventKeys.length - 1] !== newEventKeys[newEventKeys.length - 1];

  return { triggers, newState, hasRelevantChanges };
}
