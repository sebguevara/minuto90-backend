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

export function buildEventKey(event: ApiFootballFixtureEvent): string {
  const elapsed = event?.time?.elapsed ?? "";
  const extra = event?.time?.extra ?? "";
  const team = event?.team?.id ?? event?.team?.name ?? "";
  const player = event?.player?.id ?? event?.player?.name ?? "";
  const type = event?.type ?? "";
  const detail = event?.detail ?? "";
  const comments = event?.comments ?? "";
  return [type, detail, team, player, elapsed, extra, comments].join("|");
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

  // GOAL (multi-event): generate one trigger per NEW goal event not seen before
  if (!isColdStart) {
    for (const e of newEvents) {
      if (e?.type !== "Goal") continue;
      const playerName = scorerFromEvent(e);
      if (!playerName) continue;
      const k = buildEventKey(e);
      if (oldEventKeySet.has(k)) continue;
      triggers.push({
        fixtureId,
        type: "GOAL",
        eventKey: `event:${k}`,
        message: templates.goal({
          homeTeam,
          awayTeam,
          leagueName,
          matchUrl,
          scoreHome: newScoreHome,
          scoreAway: newScoreAway,
          teamName: teamFromEvent(e, newFixture),
          playerName,
          assistName: assistFromEvent(e),
          minute: minuteFromEvent(e),
        }),
      });
    }
  }

  // Fallback for GOAL when score increases but events are missing/incomplete
  if (
    !isColdStart &&
    (newScoreHome > oldScoreHome || newScoreAway > oldScoreAway) &&
    !triggers.some((t) => t.type === "GOAL")
  ) {
    const goalEvent = lastEvent(newFixture.events, (e) => e?.type === "Goal");
    const playerName = scorerFromEvent(goalEvent);
    if (!playerName) {
      // Don't send incomplete goal notifications; wait until provider includes scorer.
      // If provider never includes events, we prefer to skip rather than send wrong/duplicate messages.
    } else {
    triggers.push({
      fixtureId,
      type: "GOAL",
      eventKey: `score:${oldScoreHome}-${oldScoreAway}->${newScoreHome}-${newScoreAway}`,
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

  // RED_CARD
  if (!isColdStart) {
    for (const e of newEvents) {
      if (e?.type !== "Card" || e?.detail !== "Red Card") continue;
      const k = buildEventKey(e);
      if (oldEventKeySet.has(k)) continue;
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
