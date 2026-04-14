export interface HomeAwayRecord {
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
}

export interface TeamComparisonProfile {
  teamId: number;
  teamName: string;
  teamLogo: string | null;
  leagueName: string;
  leagueId: number;
  leagueLogo: string | null;
  season: number;

  // Competition context
  leagueType: string;
  leagueRank: number | null;
  points: number | null;
  goalDiff: number | null;
  form: string | null;

  // Absolute counts (always available from API-Football)
  matchesPlayed: number;
  totalGoalsFor: number;
  totalGoalsAgainst: number;
  wins: number;
  draws: number;
  losses: number;

  // Home/away splits (from standings)
  homeRecord: HomeAwayRecord | null;
  awayRecord: HomeAwayRecord | null;

  // Per-game / percentage metrics
  goalsPerGame: number | null;
  concededPerGame: number | null;
  winsPerGame: number | null;
  drawsPerGame: number | null;
  lossesPerGame: number | null;
  cleanSheetPct: number | null;
  penaltyScoredPct: number | null;
  yellowCardsPerGame: number | null;
  redCardsPerGame: number | null;

  // WhoScored stats
  shotsPg: number | null;
  shotsOnTargetPg: number | null;
  possessionAvg: number | null;
  xgPerGame: number | null;
  xgAgainstPerGame: number | null;
  foulsPg: number | null;
  offsidesPg: number | null;

  // WhoScored profile
  strengths: string[];
  weaknesses: string[];
  styleOfPlay: string[];
}
