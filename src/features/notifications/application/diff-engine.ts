import type {
  ApiFootballFixtureEvent,
  ApiFootballLiveFixture,
} from "../infrastructure/api-football-live.client";
import { templates } from "./templates";
import { buildMatchUrl } from "./match-url";

export type DiffTriggerType =
  | "KICKOFF"
  | "GOAL"
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
const ignoredGoalDetails = new Set(["Missed Penalty"]);

function asScore(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getTeamNames(fixture: ApiFootballLiveFixture) {
  const homeTeam = fixture.teams?.home?.name ?? "Home";
  const awayTeam = fixture.teams?.away?.name ?? "Away";
  const leagueName = fixture.league?.name ?? "League";
  return { homeTeam, awayTeam, leagueName };
}

function lastEvent(events: ApiFootballFixtureEvent[] | undefined, predicate: (e: ApiFootballFixtureEvent) => boolean) {
  if (!events?.length) return null;
  for (let i = events.length - 1; i >= 0; i--) {
    if (predicate(events[i])) return events[i];
  }
  return null;
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

function countSignatureGoals(events: ApiFootballFixtureEvent[] | undefined, sig: string): number {
  if (!events?.length) return 0;
  let n = 0;
  for (const e of events) {
    if (isNotifiableGoalEvent(e) && goalSignature(e) === sig) n++;
  }
  return n;
}

function isNotifiableGoalEvent(event: ApiFootballFixtureEvent | null | undefined) {
  if (!event || event.type !== "Goal") return false;
  const detail = event.detail ?? "";
  return !ignoredGoalDetails.has(detail);
}

/** Goles nuevos en `newEvents` respetando orden (misma firma: enésima ocurrencia > la que había en old). */
function collectNewGoalEvents(
  oldEvents: ApiFootballFixtureEvent[] | undefined,
  newEvents: ApiFootballFixtureEvent[]
): ApiFootballFixtureEvent[] {
  const ordered: ApiFootballFixtureEvent[] = [];
  const nthBySig = new Map<string, number>();
  for (const e of newEvents) {
    if (!isNotifiableGoalEvent(e)) continue;
    const sig = goalSignature(e);
    const prevCount = countSignatureGoals(oldEvents, sig);
    const nth = (nthBySig.get(sig) ?? 0) + 1;
    nthBySig.set(sig, nth);
    if (nth > prevCount) ordered.push(e);
  }
  return ordered;
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

function goalTransitionEventKey(rh: number, ra: number, nh: number, na: number) {
  return `transition:${rh}-${ra}-${nh}-${na}`;
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

  // VAR_CANCELLED
  if (!isColdStart && (newScoreHome < oldScoreHome || newScoreAway < oldScoreAway)) {
    triggers.push({
      fixtureId,
      type: "VAR_CANCELLED",
      eventKey: `score:${oldScoreHome}-${oldScoreAway}->${newScoreHome}-${newScoreAway}`,
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

  // GOAL: dedup estable (firma sin minuto) + misma clave ledger que fallback (transición de marcador).
  if (!isColdStart) {
    const oldFeed = oldState?.fixture?.events;
    const newGoalsOrdered = collectNewGoalEvents(oldFeed, newEvents);
    let rh = oldScoreHome;
    let ra = oldScoreAway;

    for (const e of newGoalsOrdered) {
      const playerName = scorerFromEvent(e);
      if (!playerName) continue;
      const [nh, na] = bumpScoreForGoal(e, newFixture, rh, ra);
      triggers.push({
        fixtureId,
        type: "GOAL",
        eventKey: goalTransitionEventKey(rh, ra, nh, na),
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

    // Fallback: sube el marcador pero no hay fila de gol “nueva” (API sin events o scorer tarde).
    if (
      (newScoreHome > oldScoreHome || newScoreAway > oldScoreAway) &&
      !triggers.some((t) => t.type === "GOAL")
    ) {
      const goalEvent = lastEvent(newFixture.events, (ev) => isNotifiableGoalEvent(ev));
      const playerName = scorerFromEvent(goalEvent);
      if (playerName) {
        triggers.push({
          fixtureId,
          type: "GOAL",
          eventKey: goalTransitionEventKey(oldScoreHome, oldScoreAway, newScoreHome, newScoreAway),
          message: templates.goal({
            homeTeam,
            awayTeam,
            leagueName,
            matchUrl,
            scoreHome: newScoreHome,
            scoreAway: newScoreAway,
            teamName: teamFromEvent(goalEvent, newFixture),
            playerName,
            assistName: assistFromEvent(goalEvent),
            minute: minuteFromEvent(goalEvent),
          }),
        });
      }
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
  const elapsedForStatus = newFixture.fixture.status?.elapsed ?? null;
  const isLikelyBreak =
    breakStatuses.has(oldStatus ?? "") ||
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
