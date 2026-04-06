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

/** Firma estable del gol (sin minuto/extra): API-Football a veces corrige 35′→36′ y cambiaba la clave → doble WhatsApp. */
function goalSignature(e: ApiFootballFixtureEvent): string {
  const team = e?.team?.id ?? e?.team?.name ?? "";
  const player = e?.player?.id ?? e?.player?.name ?? "";
  const detail = e?.detail ?? "";
  return `${detail}|${team}|${player}`;
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
    if (isRegularPlayMatchGoalForNotification(e, inShootout) && goalSignature(e) === sig) n++;
  }
  return n;
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

/** Goles nuevos en `newEvents` respetando orden (misma firma: enésima ocurrencia > la que había en old). */
function collectNewGoalEvents(
  oldEvents: ApiFootballFixtureEvent[] | undefined,
  newEvents: ApiFootballFixtureEvent[],
  inShootout: boolean = false
): Array<{ event: ApiFootballFixtureEvent; nth: number }> {
  const ordered: Array<{ event: ApiFootballFixtureEvent; nth: number }> = [];
  const nthBySig = new Map<string, number>();
  for (const e of newEvents) {
    if (!isRegularPlayMatchGoalForNotification(e, inShootout)) continue;
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
  oldEventKeySet: Set<string>,
  newEvents: ApiFootballFixtureEvent[],
  newStatus: string | null,
  isColdStart: boolean
): ApiFootballFixtureEvent[] {
  if (isColdStart || newStatus !== "P") return [];
  const out: ApiFootballFixtureEvent[] = [];
  for (const e of newEvents) {
    if (!isShootoutKickEvent(e)) continue;
    if (isEventAlreadyKnown(oldEventKeySet, e)) continue;
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
      const k = buildEventKey(e);
      triggers.push({
        fixtureId,
        type: "VAR_CANCELLED",
        eventKey: `event:${k}`,
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
        eventKey: `score_drop:${oldScoreHome}-${oldScoreAway}->${newScoreHome}-${newScoreAway}`,
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

  // GOAL: solo filas nuevas en `events` (nunca inventar gol con el “último evento” si el marcador sube solo).
  // Marcador en el mensaje = API solo cuando hay exactamente un gol nuevo y coincide el delta (+1).
  // Nota: penales durante el juego normal (detail=Penalty, status≠P) sí se notifican como gol.
  if (!isColdStart) {
    const netGoalDelta =
      newScoreHome - oldScoreHome + (newScoreAway - oldScoreAway);

    const oldFeed = oldState?.fixture?.events;
    const inShootout = newStatus === "P";
    const collected = collectNewGoalEvents(oldFeed, newEvents, inShootout);

    let goalsToEmit: Array<{ event: ApiFootballFixtureEvent; nth: number }> = [];
    if (netGoalDelta > 0) {
      if (collected.length === 0) {
        goalsToEmit = [];
      } else {
        const take = Math.min(netGoalDelta, collected.length);
        goalsToEmit = collected.slice(-take);
      }
    } else if (netGoalDelta === 0 && collected.length === 1) {
      goalsToEmit = collected;
    }

    let rh = oldScoreHome;
    let ra = oldScoreAway;

    for (let i = 0; i < goalsToEmit.length; i++) {
      const { event: e, nth } = goalsToEmit[i]!;
      const playerName = scorerFromEvent(e);
      if (!playerName) continue;
      const [bumpedH, bumpedA] = bumpScoreForGoal(e, newFixture, rh, ra);
      const anchorToApiSnapshot = goalsToEmit.length === 1 && netGoalDelta === 1;
      const nh = anchorToApiSnapshot ? newScoreHome : bumpedH;
      const na = anchorToApiSnapshot ? newScoreAway : bumpedA;
      triggers.push({
        fixtureId,
        type: "GOAL",
        eventKey: `goal:${goalSignature(e)}:${nth}`,
        scoreHome: nh,
        scoreAway: na,
        message: templates.goal({
          homeTeam,
          awayTeam,
          leagueName,
          matchUrl,
          scoreHome: nh,
          scoreAway: na,
          teamName: teamFromEvent(e, newFixture),
          playerName,
          assistName: assistFromEvent(e),
          minute: minuteFromEvent(e),
        }),
      });
      rh = nh;
      ra = na;
    }

    const penScore = parsePenaltyShootoutScore(newFixture);
    const newShootoutKicks = collectNewShootoutKickEvents(oldEventKeySet, newEvents, newStatus, isColdStart);
    for (const e of newShootoutKicks) {
      const detail = (e.detail ?? "").trim();
      const converted = detail !== "Missed Penalty";
      triggers.push({
        fixtureId,
        type: "PENALTY_SHOOTOUT_KICK",
        eventKey: `event:${buildEventKey(e)}`,
        message: templates.penaltyShootoutKick({
          homeTeam,
          awayTeam,
          leagueName,
          matchUrl,
          teamName: teamFromEvent(e, newFixture),
          playerName: playerNameOrUnknown(e),
          minute: minuteFromEvent(e),
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
