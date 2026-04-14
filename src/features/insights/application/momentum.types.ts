export type MomentumSignalType =
  | "shot_pressure"
  | "possession_swing"
  | "corner_cluster"
  | "defensive_collapse"
  | "xg_surge"
  | "discipline_risk";

export interface MomentumSignal {
  fixtureId: number;
  minute: number;
  homeTeam: string;
  awayTeam: string;
  signalType: MomentumSignalType;
  team: "home" | "away";
  stats: Record<string, number | string>;
  delta: Record<string, number>;
  probability?: number;
}

export interface MomentumNarrative {
  narrative: string;
  cardTitle: string;
  emoji: string;
}
