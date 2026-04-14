export type ApiFootballScalar = string | number | boolean;

export type ApiFootballErrorBag = string[] | Record<string, string>;

export type ApiFootballParameters<TParameters extends object> = {
  [K in keyof TParameters]?: string;
} & Record<string, string | undefined>;

export interface ApiFootballPaging {
  current: number;
  total: number;
}

export interface ApiFootballEnvelope<
  TResponse,
  TParameters extends object = Record<string, unknown>,
> {
  get: string;
  parameters: ApiFootballParameters<TParameters>;
  errors: ApiFootballErrorBag;
  results: number;
  paging?: ApiFootballPaging;
  response: TResponse;
}

export interface ApiFootballCountry {
  name: string;
  code: string | null;
  flag: string | null;
}

export interface ApiFootballLeague {
  id: number;
  name: string;
  type: string;
  logo: string;
}

export interface ApiFootballCountrySummary {
  name: string;
  code: string | null;
  flag: string | null;
}

export interface ApiFootballSeasonCoverageFixtures {
  events: boolean;
  lineups: boolean;
  statistics_fixtures: boolean;
  statistics_players: boolean;
}

export interface ApiFootballSeasonCoverage {
  fixtures: ApiFootballSeasonCoverageFixtures;
  standings: boolean;
  players: boolean;
  top_scorers: boolean;
  top_assists: boolean;
  top_cards: boolean;
  injuries: boolean;
  predictions: boolean;
  odds: boolean;
}

export interface ApiFootballSeason {
  year: number;
  start: string;
  end: string;
  current: boolean;
  coverage: ApiFootballSeasonCoverage;
}

export interface ApiFootballLeagueItem {
  league: ApiFootballLeague;
  country: ApiFootballCountrySummary;
  seasons: ApiFootballSeason[];
}

export type ApiFootballFixtureStatusShort =
  | "NS"
  | "TBD"
  | "1H"
  | "HT"
  | "2H"
  | "ET"
  | "BT"
  | "P"
  | "SUSP"
  | "INT"
  | "FT"
  | "AET"
  | "PEN"
  | "PST"
  | "CANC"
  | "ABD"
  | "AWD"
  | "WO"
  | "LIVE"
  | string;

export interface ApiFootballFixturePeriods {
  first: number | null;
  second: number | null;
}

export interface ApiFootballVenue {
  id: number | null;
  name: string | null;
  city: string | null;
  address?: string | null;
  country?: string | null;
  capacity?: number | null;
  surface?: string | null;
  image?: string | null;
}

export interface ApiFootballFixtureStatus {
  long: string;
  short: ApiFootballFixtureStatusShort;
  elapsed: number | null;
  extra: number | null;
}

export interface ApiFootballFixtureClockAnchor {
  elapsed: number;
  anchoredAtMs: number;
  serverNowMs: number;
  source: "match_state" | "snapshot";
}

export interface ApiFootballFixtureInfo {
  id: number;
  referee: string | null;
  timezone: string;
  date: string;
  timestamp: number;
  periods: ApiFootballFixturePeriods;
  venue: ApiFootballVenue;
  status: ApiFootballFixtureStatus;
  clockAnchor?: ApiFootballFixtureClockAnchor;
}

export interface ApiFootballFixtureLeague {
  id: number;
  name: string;
  country: string;
  logo: string;
  flag: string | null;
  season: number;
  round: string;
}

export interface ApiFootballFixtureTeam {
  id: number;
  name: string;
  logo: string;
  winner: boolean | null;
}

export interface ApiFootballFixtureTeams {
  home: ApiFootballFixtureTeam;
  away: ApiFootballFixtureTeam;
}

export interface ApiFootballGoals {
  home: number | null;
  away: number | null;
}

export interface ApiFootballScoreSection {
  home: number | null;
  away: number | null;
}

export interface ApiFootballScore {
  halftime: ApiFootballScoreSection;
  fulltime: ApiFootballScoreSection;
  extratime: ApiFootballScoreSection;
  penalty: ApiFootballScoreSection;
}

export interface ApiFootballFixtureItem {
  fixture: ApiFootballFixtureInfo;
  league: ApiFootballFixtureLeague;
  teams: ApiFootballFixtureTeams;
  goals: ApiFootballGoals;
  score: ApiFootballScore;
}

export interface ApiFootballTeamReference {
  id: number | null;
  name: string | null;
  logo?: string | null;
  code?: string | null;
  country?: string | null;
  founded?: number | null;
  national?: boolean | null;
}

export interface ApiFootballPersonReference {
  id: number | null;
  name: string | null;
}

export interface ApiFootballFixtureStatisticLine {
  type: string;
  value: number | string | boolean | null;
}

export interface ApiFootballFixtureStatisticsItem {
  team: {
    id: number;
    name: string;
    logo: string;
  };
  statistics: ApiFootballFixtureStatisticLine[];
}

export interface ApiFootballFixtureEventTime {
  elapsed: number | null;
  extra: number | null;
}

export interface ApiFootballFixtureEvent {
  time: ApiFootballFixtureEventTime;
  team: {
    id: number;
    name: string;
    logo: string;
  };
  player: ApiFootballPersonReference;
  assist: ApiFootballPersonReference;
  type: string;
  detail: string;
  comments: string | null;
}

export interface ApiFootballLineupColorsPalette {
  primary: string;
  number: string;
  border: string;
}

export interface ApiFootballLineupColors {
  player: ApiFootballLineupColorsPalette;
  goalkeeper: ApiFootballLineupColorsPalette;
}

export interface ApiFootballLineupTeam {
  id: number;
  name: string;
  logo: string;
  colors: ApiFootballLineupColors;
}

export interface ApiFootballLineupPlayer {
  id: number;
  name: string;
  number: number | null;
  pos: string | null;
  grid: string | null;
}

export interface ApiFootballLineupPlayerSlot {
  player: ApiFootballLineupPlayer;
}

export interface ApiFootballCoach {
  id: number;
  name: string;
  photo: string;
}

export interface ApiFootballFixtureLineup {
  team: ApiFootballLineupTeam;
  formation: string;
  startXI: ApiFootballLineupPlayerSlot[];
  substitutes: ApiFootballLineupPlayerSlot[];
  coach: ApiFootballCoach;
}

export interface ApiFootballPlayerGameStats {
  minutes: number | null;
  number: number | null;
  position: string | null;
  rating: string | null;
  captain: boolean;
  substitute: boolean;
}

export interface ApiFootballPlayerShotsStats {
  total: number | null;
  on: number | null;
}

export interface ApiFootballPlayerGoalsStats {
  total: number | null;
  conceded: number | null;
  assists: number | null;
  saves: number | null;
}

export interface ApiFootballPlayerPassesStats {
  total: number | null;
  key: number | null;
  accuracy: string | null;
}

export interface ApiFootballPlayerTacklesStats {
  total: number | null;
  blocks: number | null;
  interceptions: number | null;
}

export interface ApiFootballPlayerDuelsStats {
  total: number | null;
  won: number | null;
}

export interface ApiFootballPlayerDribblesStats {
  attempts: number | null;
  success: number | null;
  past: number | null;
}

export interface ApiFootballPlayerFoulsStats {
  drawn: number | null;
  committed: number | null;
}

export interface ApiFootballPlayerCardsStats {
  yellow: number | null;
  red: number | null;
}

export interface ApiFootballPlayerPenaltyStats {
  won: number | null;
  commited: number | null;
  scored: number | null;
  missed: number | null;
  saved: number | null;
}

export interface ApiFootballFixturePlayerStatistic {
  games: ApiFootballPlayerGameStats;
  offsides: number | null;
  shots: ApiFootballPlayerShotsStats;
  goals: ApiFootballPlayerGoalsStats;
  passes: ApiFootballPlayerPassesStats;
  tackles: ApiFootballPlayerTacklesStats;
  duels: ApiFootballPlayerDuelsStats;
  dribbles: ApiFootballPlayerDribblesStats;
  fouls: ApiFootballPlayerFoulsStats;
  cards: ApiFootballPlayerCardsStats;
  penalty: ApiFootballPlayerPenaltyStats;
}

export interface ApiFootballFixturePlayer {
  player: {
    id: number;
    name: string;
    photo: string;
  };
  statistics: ApiFootballFixturePlayerStatistic[];
}

export interface ApiFootballFixturePlayersItem {
  team: {
    id: number;
    name: string;
    logo: string;
    update: string;
  };
  players: ApiFootballFixturePlayer[];
}

export interface ApiFootballTeamItem {
  team: {
    id: number;
    name: string;
    code: string | null;
    country: string;
    founded: number | null;
    national: boolean;
    logo: string;
  };
  venue: ApiFootballVenue;
}

export interface ApiFootballTeamStatisticsReference {
  id: number;
  name: string;
  logo?: string | null;
}

export interface ApiFootballTeamStatisticsSplit {
  home: number | null;
  away: number | null;
  total: number | null;
}

export interface ApiFootballTeamStatisticsFixturesSection {
  played?: ApiFootballTeamStatisticsSplit;
  wins?: ApiFootballTeamStatisticsSplit;
  draws?: ApiFootballTeamStatisticsSplit;
  loses?: ApiFootballTeamStatisticsSplit;
}

export interface ApiFootballTeamStatisticsGoalsAverageSection {
  home: string | null;
  away: string | null;
  total: string | null;
}

export interface ApiFootballTeamStatisticsGoalsMinuteSection {
  total: number | null;
  percentage: string | null;
}

export interface ApiFootballTeamStatisticsGoalsMinutes {
  "0-15"?: ApiFootballTeamStatisticsGoalsMinuteSection;
  "16-30"?: ApiFootballTeamStatisticsGoalsMinuteSection;
  "31-45"?: ApiFootballTeamStatisticsGoalsMinuteSection;
  "46-60"?: ApiFootballTeamStatisticsGoalsMinuteSection;
  "61-75"?: ApiFootballTeamStatisticsGoalsMinuteSection;
  "76-90"?: ApiFootballTeamStatisticsGoalsMinuteSection;
  "91-105"?: ApiFootballTeamStatisticsGoalsMinuteSection;
  "106-120"?: ApiFootballTeamStatisticsGoalsMinuteSection;
  [key: string]: ApiFootballTeamStatisticsGoalsMinuteSection | undefined;
}

export interface ApiFootballTeamStatisticsGoalsBlock {
  total?: ApiFootballTeamStatisticsSplit;
  average?: ApiFootballTeamStatisticsGoalsAverageSection;
  minute?: ApiFootballTeamStatisticsGoalsMinutes;
}

export interface ApiFootballTeamStatisticsGoalsSection {
  for?: ApiFootballTeamStatisticsGoalsBlock;
  against?: ApiFootballTeamStatisticsGoalsBlock;
}

export interface ApiFootballTeamStatisticsBiggestStreak {
  wins: number | null;
  draws: number | null;
  loses: number | null;
}

export interface ApiFootballTeamStatisticsBiggestMatch {
  home: string | null;
  away: string | null;
}

export interface ApiFootballTeamStatisticsBiggestGoals {
  for: ApiFootballTeamStatisticsBiggestMatch;
  against: ApiFootballTeamStatisticsBiggestMatch;
}

export interface ApiFootballTeamStatisticsBiggestSection {
  streak?: ApiFootballTeamStatisticsBiggestStreak;
  wins?: ApiFootballTeamStatisticsBiggestMatch;
  loses?: ApiFootballTeamStatisticsBiggestMatch;
  goals?: ApiFootballTeamStatisticsBiggestGoals;
}

export interface ApiFootballTeamStatisticsCleanFailedSection {
  home: number | null;
  away: number | null;
  total: number | null;
}

export interface ApiFootballTeamStatisticsPenaltySection {
  scored?: {
    total: number | null;
    percentage: string | null;
  };
  missed?: {
    total: number | null;
    percentage: string | null;
  };
  total?: number | null;
}

export interface ApiFootballTeamStatisticsLineupsItem {
  formation: string;
  played: number;
}

export interface ApiFootballTeamStatisticsCardsMinuteSection {
  total: number | null;
  percentage: string | null;
}

export interface ApiFootballTeamStatisticsCardsColorSection {
  "0-15"?: ApiFootballTeamStatisticsCardsMinuteSection;
  "16-30"?: ApiFootballTeamStatisticsCardsMinuteSection;
  "31-45"?: ApiFootballTeamStatisticsCardsMinuteSection;
  "46-60"?: ApiFootballTeamStatisticsCardsMinuteSection;
  "61-75"?: ApiFootballTeamStatisticsCardsMinuteSection;
  "76-90"?: ApiFootballTeamStatisticsCardsMinuteSection;
  "91-105"?: ApiFootballTeamStatisticsCardsMinuteSection;
  "106-120"?: ApiFootballTeamStatisticsCardsMinuteSection;
  [key: string]: ApiFootballTeamStatisticsCardsMinuteSection | undefined;
}

export interface ApiFootballTeamStatisticsResponse {
  league: ApiFootballTeamStatisticsReference;
  team: ApiFootballTeamStatisticsReference;
  form?: string | null;
  fixtures?: ApiFootballTeamStatisticsFixturesSection;
  goals?: ApiFootballTeamStatisticsGoalsSection;
  biggest?: ApiFootballTeamStatisticsBiggestSection;
  clean_sheet?: ApiFootballTeamStatisticsCleanFailedSection;
  failed_to_score?: ApiFootballTeamStatisticsCleanFailedSection;
  penalty?: ApiFootballTeamStatisticsPenaltySection;
  lineups?: ApiFootballTeamStatisticsLineupsItem[];
  cards?: {
    yellow?: ApiFootballTeamStatisticsCardsColorSection;
    red?: ApiFootballTeamStatisticsCardsColorSection;
  };
  [key: string]: unknown;
}

export interface ApiFootballStandingTeam {
  id: number;
  name: string;
  logo?: string | null;
}

export interface ApiFootballStandingAllSplit {
  played: number | null;
  win: number | null;
  draw: number | null;
  lose: number | null;
  goals: {
    for: number | null;
    against: number | null;
  };
}

export interface ApiFootballStandingRow {
  rank: number;
  team: ApiFootballStandingTeam;
  points: number;
  goalsDiff: number;
  group: string;
  form: string | null;
  status?: string | null;
  description?: string | null;
  all?: ApiFootballStandingAllSplit;
  home?: ApiFootballStandingAllSplit;
  away?: ApiFootballStandingAllSplit;
  update?: string | null;
}

export interface ApiFootballStandingsLeague {
  id: number;
  name: string;
  country?: string | null;
  logo?: string | null;
  flag?: string | null;
  season?: number | null;
  standings: ApiFootballStandingRow[][];
}

export interface ApiFootballStandingsItem {
  league: ApiFootballStandingsLeague;
}

export interface ApiFootballInjuryItem {
  player: {
    id: number;
    name: string;
    type: string;
    reason: string;
    photo?: string | null;
  };
  team: {
    id: number;
    name: string;
    logo?: string | null;
  };
  fixture: {
    id: number;
    date: string;
    timezone?: string | null;
    timestamp?: number | null;
  };
  league?: {
    id: number;
    season: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
  };
}

export interface ApiFootballPredictionWinner {
  id: number | null;
  name: string | null;
  comment: string | null;
}

export interface ApiFootballPredictionGoalsAdvice {
  home: string | null;
  away: string | null;
}

export interface ApiFootballPredictionPercent {
  home: string | null;
  draw: string | null;
  away: string | null;
}

export interface ApiFootballPredictionBlock {
  winner: ApiFootballPredictionWinner;
  win_or_draw: boolean;
  under_over: string | null;
  goals: ApiFootballPredictionGoalsAdvice;
  advice: string | null;
  percent: ApiFootballPredictionPercent;
}

export interface ApiFootballPredictionGoalsTotal {
  total: number | null;
  average: number | string | null;
}

export interface ApiFootballPredictionLastFiveGoals {
  for: ApiFootballPredictionGoalsTotal;
  against: ApiFootballPredictionGoalsTotal;
}

export interface ApiFootballPredictionLastFive {
  form: string | null;
  att: string | null;
  def: string | null;
  goals: ApiFootballPredictionLastFiveGoals;
}

export interface ApiFootballPredictionLeagueTeamStats {
  form?: string | null;
  fixtures?: ApiFootballTeamStatisticsFixturesSection;
  goals?: {
    for?: {
      total?: ApiFootballTeamStatisticsSplit;
      average?: ApiFootballTeamStatisticsGoalsAverageSection;
    };
    against?: {
      total?: ApiFootballTeamStatisticsSplit;
      average?: ApiFootballTeamStatisticsGoalsAverageSection;
    };
  };
  biggest?: ApiFootballTeamStatisticsBiggestSection;
  clean_sheet?: ApiFootballTeamStatisticsCleanFailedSection;
  failed_to_score?: ApiFootballTeamStatisticsCleanFailedSection;
  [key: string]: unknown;
}

export interface ApiFootballPredictionTeam {
  id: number;
  name: string;
  logo: string;
  last_5: ApiFootballPredictionLastFive;
  league: ApiFootballPredictionLeagueTeamStats;
}

export interface ApiFootballPredictionComparison {
  form?: Record<string, string | null>;
  att?: Record<string, string | null>;
  def?: Record<string, string | null>;
  poisson_distribution?: Record<string, string | null>;
  h2h?: Record<string, string | null>;
  goals?: Record<string, string | null>;
  total?: Record<string, string | null>;
  [key: string]: Record<string, string | null> | undefined;
}

export interface ApiFootballPredictionItem {
  predictions: ApiFootballPredictionBlock;
  league: ApiFootballFixtureLeague;
  teams: {
    home: ApiFootballPredictionTeam;
    away: ApiFootballPredictionTeam;
  };
  comparison: ApiFootballPredictionComparison;
  h2h: ApiFootballFixtureItem[];
}

export interface ApiFootballCoachCareerItem {
  team: {
    id: number;
    name: string;
    logo: string;
  };
  start: string;
  end: string | null;
}

export interface ApiFootballCoachItem {
  id: number;
  name: string;
  firstname: string | null;
  lastname: string | null;
  age: number | null;
  birth: {
    date: string | null;
    place: string | null;
    country: string | null;
  };
  nationality: string | null;
  height: string | null;
  weight: string | null;
  photo: string | null;
  team: {
    id: number;
    name: string;
    logo: string;
  };
  career: ApiFootballCoachCareerItem[];
}

export interface ApiFootballPlayerProfile {
  id: number;
  name: string;
  firstname: string | null;
  lastname: string | null;
  age: number | null;
  birth: {
    date: string | null;
    place: string | null;
    country: string | null;
  };
  nationality: string | null;
  height: string | null;
  weight: string | null;
  number?: number | null;
  position?: string | null;
  injured?: boolean | null;
  photo: string | null;
}

export interface ApiFootballPlayerProfileItem {
  player: ApiFootballPlayerProfile;
}

export interface ApiFootballPlayerStatisticsLeague {
  id: number;
  name: string;
  country: string;
  logo: string;
  flag: string | null;
  season: number;
}

export interface ApiFootballPlayerGamesStats {
  appearences?: number | null;
  lineups?: number | null;
  minutes?: number | null;
  number?: number | null;
  position?: string | null;
  rating?: string | null;
  captain?: boolean | null;
}

export interface ApiFootballPlayerSubstitutesStats {
  in?: number | null;
  out?: number | null;
  bench?: number | null;
}

export interface ApiFootballPlayerCardsExtendedStats {
  yellow?: number | null;
  yellowred?: number | null;
  red?: number | null;
}

export interface ApiFootballPlayerPenaltyExtendedStats {
  won?: number | null;
  commited?: number | null;
  scored?: number | null;
  missed?: number | null;
  saved?: number | null;
}

export interface ApiFootballPlayerStatisticsItem {
  team: {
    id: number;
    name: string;
    logo: string;
  };
  league: ApiFootballPlayerStatisticsLeague;
  games: ApiFootballPlayerGamesStats;
  substitutes?: ApiFootballPlayerSubstitutesStats;
  shots?: ApiFootballPlayerShotsStats;
  goals?: ApiFootballPlayerGoalsStats;
  passes?: {
    total: number | null;
    key: number | null;
    accuracy: number | string | null;
  };
  tackles?: ApiFootballPlayerTacklesStats;
  duels?: ApiFootballPlayerDuelsStats;
  dribbles?: ApiFootballPlayerDribblesStats;
  fouls?: ApiFootballPlayerFoulsStats;
  cards?: ApiFootballPlayerCardsExtendedStats;
  penalty?: ApiFootballPlayerPenaltyExtendedStats;
}

export interface ApiFootballPlayerItem {
  player: ApiFootballPlayerProfile;
  statistics: ApiFootballPlayerStatisticsItem[];
}

export interface ApiFootballSquadPlayer {
  id: number;
  name: string;
  age: number | null;
  number: number | null;
  position: string | null;
  photo: string | null;
}

export interface ApiFootballPlayerSquadItem {
  team: {
    id: number;
    name: string;
    logo: string;
  };
  players: ApiFootballSquadPlayer[];
}

export interface ApiFootballPlayerTeamsItem {
  team: {
    id: number;
    name: string;
    logo: string;
  };
  seasons: number[];
}

export interface ApiFootballTransferTeam {
  id: number;
  name: string;
  logo: string;
}

export interface ApiFootballTransferRecord {
  date: string;
  type: string;
  teams: {
    in: ApiFootballTransferTeam;
    out: ApiFootballTransferTeam;
  };
}

export interface ApiFootballTransferItem {
  player: {
    id: number;
    name: string;
  };
  update: string;
  transfers: ApiFootballTransferRecord[];
}

export interface ApiFootballTrophyItem {
  league: string;
  country: string;
  season: string;
  place: string;
}

export interface ApiFootballSidelinedItem {
  type: string;
  start: string;
  end: string | null;
}

export interface ApiFootballOddsValue {
  value: string | number;
  odd: string;
  handicap?: string | null;
  main?: string | null;
  suspended?: boolean | null;
}

export interface ApiFootballOddsBet {
  id: number;
  name: string;
  values: ApiFootballOddsValue[];
}

export interface ApiFootballOddsLiveItem {
  fixture: {
    id: number;
    status: {
      long: string;
      elapsed: number | null;
      seconds: string | null;
    };
  };
  league: {
    id: number;
    season: number;
  };
  teams: {
    home: {
      id: number;
      goals: number | null;
    };
    away: {
      id: number;
      goals: number | null;
    };
  };
  status: {
    stopped: boolean;
    blocked: boolean;
    finished: boolean;
  };
  update: string;
  odds: ApiFootballOddsBet[];
}

export interface ApiFootballOddsBetTypeItem {
  id: number;
  name: string;
}

export interface ApiFootballOddsBookmakerBet {
  id: number;
  name: string;
  values: Array<{
    value: string | number;
    odd: string;
  }>;
}

export interface ApiFootballOddsBookmaker {
  id: number;
  name: string;
  bets: ApiFootballOddsBookmakerBet[];
}

export interface ApiFootballOddsItem {
  league: {
    id: number;
    name: string;
    country: string;
    season: number;
  };
  fixture: {
    id: number;
    timezone: string;
    date: string;
    timestamp: number;
  };
  update: string;
  bookmakers: ApiFootballOddsBookmaker[];
}

export interface ApiFootballOddsMappingItem {
  league: {
    id: number;
    season: number;
  };
  fixture: {
    id: number;
    date: string;
    timestamp: number;
  };
  update: string;
}

export interface ApiFootballBookmakerItem {
  id: number;
  name: string;
}

export interface GetCountriesQuery {
  name?: string;
  code?: string;
  search?: string;
}

export interface GetTimezoneQuery {}

export interface GetLeaguesQuery {
  id?: number;
  name?: string;
  code?: string;
  search?: string;
  country?: string;
  season?: number;
  current?: boolean;
  team?: number;
  type?: string;
  last?: number;
}

export interface GetLeaguesSeasonsQuery {}

export interface GetFixturesQuery {
  id?: number;
  ids?: string;
  league?: number;
  season?: number;
  team?: number;
  live?: string;
  date?: string;
  from?: string;
  to?: string;
  next?: number;
  last?: number;
  round?: string;
  status?: string;
  venue?: number;
  timezone?: string;
}

export interface GetFixtureRoundsQuery {
  league: number;
  season: number;
  current?: boolean;
  timezone?: string;
  dates?: string;
}

export interface GetFixtureHeadToHeadQuery {
  h2h: string;
  league?: number;
  season?: number;
  date?: string;
  from?: string;
  to?: string;
  next?: number;
  last?: number;
  status?: string;
  venue?: number;
  timezone?: string;
}

export interface GetFixtureStatisticsQuery {
  fixture: number;
  team?: number;
  type?: string;
  half?: string;
}

export interface GetFixtureEventsQuery {
  fixture: number;
  team?: number;
  player?: number;
  type?: string;
}

export interface GetFixtureLineupsQuery {
  fixture: number;
  team?: number;
  player?: number;
  type?: string;
}

export interface GetFixturePlayersQuery {
  fixture: number;
  team?: number;
}

export interface GetTeamStatisticsQuery {
  team: number;
  season: number;
  league: number;
  date?: string;
}

export interface GetTeamsQuery {
  id?: number;
  name?: string;
  league?: number;
  season?: number;
  country?: string;
  code?: string;
  venue?: number;
  search?: string;
}

export interface GetTeamSeasonsQuery {
  team: number;
}

export interface GetTeamCountriesQuery {}

export interface GetVenuesQuery {
  id?: number;
  name?: string;
  city?: string;
  country?: string;
  search?: string;
}

export interface GetStandingsQuery {
  league?: number;
  season: number;
  team?: number;
}

export interface GetInjuriesQuery {
  league?: number;
  season?: number;
  fixture?: number;
  team?: number;
  player?: number;
  date?: string;
  ids?: string;
  timezone?: string;
}

export interface GetPredictionsQuery {
  fixture: number;
}

export interface GetCoachsQuery {
  id?: number;
  team?: number;
  search?: string;
}

export interface GetPlayersSeasonsQuery {}

export interface GetPlayerProfilesQuery {
  player?: number;
  search?: string;
}

export interface GetPlayersQuery {
  id?: number;
  team?: number;
  league?: number;
  season?: number;
  search?: string;
  page?: number;
}

export interface GetPlayerSquadsQuery {
  team?: number;
  player?: number;
}

export interface GetPlayerTeamsQuery {
  player: number;
}

export interface GetTopPlayersQuery {
  league: number;
  season: number;
}

export interface GetTransfersQuery {
  player?: number;
  team?: number;
}

export interface GetTrophiesQuery {
  player?: number;
  players?: string;
  coach?: number;
  coachs?: string;
}

export interface GetSidelinedQuery {
  player?: number;
  players?: string;
  coach?: number;
  coachs?: string;
}

export interface GetOddsLiveQuery {
  fixture?: number;
  league?: number;
  bet?: number;
}

export interface GetOddsLiveBetsQuery {
  id?: number;
  search?: string;
}

export interface GetOddsQuery {
  fixture?: number;
  league?: number;
  season?: number;
  date?: string;
  timezone?: string;
  page?: number;
  bookmaker?: number;
  bet?: number;
}

export interface GetOddsMappingQuery {
  page?: number;
}

export interface GetOddsBookmakersQuery {
  id?: number;
  search?: string;
}

export interface GetOddsBetsQuery {
  id?: string;
  search?: string;
}

export type ApiFootballCountriesEnvelope = ApiFootballEnvelope<ApiFootballCountry[], GetCountriesQuery>;
export type ApiFootballTimezoneEnvelope = ApiFootballEnvelope<string[], GetTimezoneQuery>;
export type ApiFootballLeaguesEnvelope = ApiFootballEnvelope<ApiFootballLeagueItem[], GetLeaguesQuery>;
export type ApiFootballLeaguesSeasonsEnvelope = ApiFootballEnvelope<number[], GetLeaguesSeasonsQuery>;
export type ApiFootballFixturesEnvelope = ApiFootballEnvelope<ApiFootballFixtureItem[], GetFixturesQuery>;
export type ApiFootballFixtureRoundsEnvelope = ApiFootballEnvelope<string[], GetFixtureRoundsQuery>;
export type ApiFootballFixtureHeadToHeadEnvelope = ApiFootballEnvelope<
  ApiFootballFixtureItem[],
  GetFixtureHeadToHeadQuery
>;
export type ApiFootballFixtureStatisticsEnvelope = ApiFootballEnvelope<
  ApiFootballFixtureStatisticsItem[],
  GetFixtureStatisticsQuery
>;
export type ApiFootballFixtureEventsEnvelope = ApiFootballEnvelope<
  ApiFootballFixtureEvent[],
  GetFixtureEventsQuery
>;
export type ApiFootballFixtureLineupsEnvelope = ApiFootballEnvelope<
  ApiFootballFixtureLineup[],
  GetFixtureLineupsQuery
>;
export type ApiFootballFixturePlayersEnvelope = ApiFootballEnvelope<
  ApiFootballFixturePlayersItem[],
  GetFixturePlayersQuery
>;
export type ApiFootballTeamStatisticsEnvelope = ApiFootballEnvelope<
  ApiFootballTeamStatisticsResponse,
  GetTeamStatisticsQuery
>;
export type ApiFootballTeamsEnvelope = ApiFootballEnvelope<ApiFootballTeamItem[], GetTeamsQuery>;
export type ApiFootballTeamSeasonsEnvelope = ApiFootballEnvelope<number[], GetTeamSeasonsQuery>;
export type ApiFootballTeamCountriesEnvelope = ApiFootballEnvelope<
  ApiFootballCountry[],
  GetTeamCountriesQuery
>;
export type ApiFootballVenuesEnvelope = ApiFootballEnvelope<ApiFootballVenue[], GetVenuesQuery>;
export type ApiFootballStandingsEnvelope = ApiFootballEnvelope<
  ApiFootballStandingsItem[],
  GetStandingsQuery
>;
export type ApiFootballInjuriesEnvelope = ApiFootballEnvelope<
  ApiFootballInjuryItem[],
  GetInjuriesQuery
>;
export type ApiFootballPredictionsEnvelope = ApiFootballEnvelope<
  ApiFootballPredictionItem[],
  GetPredictionsQuery
>;
export type ApiFootballCoachsEnvelope = ApiFootballEnvelope<
  ApiFootballCoachItem[],
  GetCoachsQuery
>;
export type ApiFootballPlayersSeasonsEnvelope = ApiFootballEnvelope<
  number[],
  GetPlayersSeasonsQuery
>;
export type ApiFootballPlayerProfilesEnvelope = ApiFootballEnvelope<
  ApiFootballPlayerProfileItem[],
  GetPlayerProfilesQuery
>;
export type ApiFootballPlayersEnvelope = ApiFootballEnvelope<
  ApiFootballPlayerItem[],
  GetPlayersQuery
>;
export type ApiFootballPlayerSquadsEnvelope = ApiFootballEnvelope<
  ApiFootballPlayerSquadItem[],
  GetPlayerSquadsQuery
>;
export type ApiFootballPlayerTeamsEnvelope = ApiFootballEnvelope<
  ApiFootballPlayerTeamsItem[],
  GetPlayerTeamsQuery
>;
export type ApiFootballTopScorersEnvelope = ApiFootballEnvelope<
  ApiFootballPlayerItem[],
  GetTopPlayersQuery
>;
export type ApiFootballTopAssistsEnvelope = ApiFootballEnvelope<
  ApiFootballPlayerItem[],
  GetTopPlayersQuery
>;
export type ApiFootballTopYellowCardsEnvelope = ApiFootballEnvelope<
  ApiFootballPlayerItem[],
  GetTopPlayersQuery
>;
export type ApiFootballTopRedCardsEnvelope = ApiFootballEnvelope<
  ApiFootballPlayerItem[],
  GetTopPlayersQuery
>;
export type ApiFootballTransfersEnvelope = ApiFootballEnvelope<
  ApiFootballTransferItem[],
  GetTransfersQuery
>;
export type ApiFootballTrophiesEnvelope = ApiFootballEnvelope<
  ApiFootballTrophyItem[],
  GetTrophiesQuery
>;
export type ApiFootballSidelinedEnvelope = ApiFootballEnvelope<
  ApiFootballSidelinedItem[],
  GetSidelinedQuery
>;
export type ApiFootballOddsLiveEnvelope = ApiFootballEnvelope<
  ApiFootballOddsLiveItem[],
  GetOddsLiveQuery
>;
export type ApiFootballOddsLiveBetsEnvelope = ApiFootballEnvelope<
  ApiFootballOddsBetTypeItem[],
  GetOddsLiveBetsQuery
>;
export type ApiFootballOddsEnvelope = ApiFootballEnvelope<
  ApiFootballOddsItem[],
  GetOddsQuery
>;
export type ApiFootballOddsMappingEnvelope = ApiFootballEnvelope<
  ApiFootballOddsMappingItem[],
  GetOddsMappingQuery
>;
export type ApiFootballOddsBookmakersEnvelope = ApiFootballEnvelope<
  ApiFootballBookmakerItem[],
  GetOddsBookmakersQuery
>;
export type ApiFootballOddsBetsEnvelope = ApiFootballEnvelope<
  ApiFootballOddsBetTypeItem[],
  GetOddsBetsQuery
>;
