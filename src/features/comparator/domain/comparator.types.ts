export interface TeamComparisonProfile {
  teamId: number;
  teamName: string;
  teamLogo: string | null;
  leagueName: string;
  leagueId: number;
  leagueLogo: string | null;
  season: number;
  matchesPlayed: number;
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
