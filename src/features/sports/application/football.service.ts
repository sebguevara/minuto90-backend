import type {
  ApiFootballCountriesEnvelope,
  ApiFootballFixtureEventsEnvelope,
  ApiFootballFixtureHeadToHeadEnvelope,
  ApiFootballFixtureLineupsEnvelope,
  ApiFootballFixturePlayersEnvelope,
  ApiFootballFixtureRoundsEnvelope,
  ApiFootballFixtureStatisticsEnvelope,
  ApiFootballFixturesEnvelope,
  ApiFootballInjuriesEnvelope,
  ApiFootballLeagueItem,
  ApiFootballLeaguesEnvelope,
  ApiFootballLeaguesSeasonsEnvelope,
  ApiFootballPlayerProfilesEnvelope,
  ApiFootballPlayersEnvelope,
  ApiFootballPlayersSeasonsEnvelope,
  ApiFootballPlayerSquadsEnvelope,
  ApiFootballPlayerTeamsEnvelope,
  ApiFootballPredictionsEnvelope,
  ApiFootballSidelinedEnvelope,
  ApiFootballStandingsEnvelope,
  ApiFootballTeamCountriesEnvelope,
  ApiFootballTeamSeasonsEnvelope,
  ApiFootballTeamsEnvelope,
  ApiFootballTeamStatisticsEnvelope,
  ApiFootballTimezoneEnvelope,
  ApiFootballTopAssistsEnvelope,
  ApiFootballTopRedCardsEnvelope,
  ApiFootballTopScorersEnvelope,
  ApiFootballTopYellowCardsEnvelope,
  ApiFootballTransfersEnvelope,
  ApiFootballTrophiesEnvelope,
  ApiFootballVenuesEnvelope,
  ApiFootballCoachsEnvelope,
  ApiFootballOddsBetsEnvelope,
  ApiFootballOddsBookmakersEnvelope,
  ApiFootballOddsEnvelope,
  ApiFootballOddsLiveBetsEnvelope,
  ApiFootballOddsLiveEnvelope,
  ApiFootballOddsMappingEnvelope,
  GetCoachsQuery,
  GetCountriesQuery,
  GetFixtureEventsQuery,
  GetFixtureHeadToHeadQuery,
  GetFixtureLineupsQuery,
  GetFixturePlayersQuery,
  GetFixtureRoundsQuery,
  GetFixtureStatisticsQuery,
  GetFixturesQuery,
  GetInjuriesQuery,
  GetLeaguesQuery,
  GetPlayerProfilesQuery,
  GetPlayersQuery,
  GetPlayersSeasonsQuery,
  GetPlayerSquadsQuery,
  GetPlayerTeamsQuery,
  GetPredictionsQuery,
  GetSidelinedQuery,
  GetStandingsQuery,
  GetTeamCountriesQuery,
  GetTeamsQuery,
  GetTeamSeasonsQuery,
  GetTeamStatisticsQuery,
  GetTransfersQuery,
  GetTrophiesQuery,
  GetTopPlayersQuery,
  GetOddsBetsQuery,
  GetOddsBookmakersQuery,
  GetOddsLiveBetsQuery,
  GetOddsLiveQuery,
  GetOddsMappingQuery,
  GetOddsQuery,
  GetTimezoneQuery,
  GetVenuesQuery,
} from "../domain/football.types";
import {
  footballApiClient,
  type FootballApiClientContract,
} from "../infrastructure/football-api.client";

export interface FootballServiceContract {
  getCountries(query: GetCountriesQuery): Promise<ApiFootballCountriesEnvelope>;
  getTimezone(): Promise<ApiFootballTimezoneEnvelope>;
  getLeagues(query: GetLeaguesQuery): Promise<ApiFootballLeaguesEnvelope>;
  getLeagueSeasons(): Promise<ApiFootballLeaguesSeasonsEnvelope>;
  getFixtures(query: GetFixturesQuery): Promise<ApiFootballFixturesEnvelope>;
  getFixtureRounds(query: GetFixtureRoundsQuery): Promise<ApiFootballFixtureRoundsEnvelope>;
  getFixtureHeadToHead(
    query: GetFixtureHeadToHeadQuery
  ): Promise<ApiFootballFixtureHeadToHeadEnvelope>;
  getFixtureStatistics(
    query: GetFixtureStatisticsQuery
  ): Promise<ApiFootballFixtureStatisticsEnvelope>;
  getFixtureEvents(query: GetFixtureEventsQuery): Promise<ApiFootballFixtureEventsEnvelope>;
  getFixtureLineups(query: GetFixtureLineupsQuery): Promise<ApiFootballFixtureLineupsEnvelope>;
  getFixturePlayers(query: GetFixturePlayersQuery): Promise<ApiFootballFixturePlayersEnvelope>;
  getTeams(query: GetTeamsQuery): Promise<ApiFootballTeamsEnvelope>;
  getTeamStatistics(query: GetTeamStatisticsQuery): Promise<ApiFootballTeamStatisticsEnvelope>;
  getTeamSeasons(query: GetTeamSeasonsQuery): Promise<ApiFootballTeamSeasonsEnvelope>;
  getTeamCountries(): Promise<ApiFootballTeamCountriesEnvelope>;
  getVenues(query: GetVenuesQuery): Promise<ApiFootballVenuesEnvelope>;
  getStandings(query: GetStandingsQuery): Promise<ApiFootballStandingsEnvelope>;
  getInjuries(query: GetInjuriesQuery): Promise<ApiFootballInjuriesEnvelope>;
  getPredictions(query: GetPredictionsQuery): Promise<ApiFootballPredictionsEnvelope>;
  getCoachs(query: GetCoachsQuery): Promise<ApiFootballCoachsEnvelope>;
  getPlayersSeasons(): Promise<ApiFootballPlayersSeasonsEnvelope>;
  getPlayerProfiles(query: GetPlayerProfilesQuery): Promise<ApiFootballPlayerProfilesEnvelope>;
  getPlayers(query: GetPlayersQuery): Promise<ApiFootballPlayersEnvelope>;
  getPlayerSquads(query: GetPlayerSquadsQuery): Promise<ApiFootballPlayerSquadsEnvelope>;
  getPlayerTeams(query: GetPlayerTeamsQuery): Promise<ApiFootballPlayerTeamsEnvelope>;
  getPlayersTopScorers(query: GetTopPlayersQuery): Promise<ApiFootballTopScorersEnvelope>;
  getPlayersTopAssists(query: GetTopPlayersQuery): Promise<ApiFootballTopAssistsEnvelope>;
  getPlayersTopYellowCards(query: GetTopPlayersQuery): Promise<ApiFootballTopYellowCardsEnvelope>;
  getPlayersTopRedCards(query: GetTopPlayersQuery): Promise<ApiFootballTopRedCardsEnvelope>;
  getTransfers(query: GetTransfersQuery): Promise<ApiFootballTransfersEnvelope>;
  getTrophies(query: GetTrophiesQuery): Promise<ApiFootballTrophiesEnvelope>;
  getSidelined(query: GetSidelinedQuery): Promise<ApiFootballSidelinedEnvelope>;
  getOddsLive(query: GetOddsLiveQuery): Promise<ApiFootballOddsLiveEnvelope>;
  getOddsLiveBets(query: GetOddsLiveBetsQuery): Promise<ApiFootballOddsLiveBetsEnvelope>;
  getOdds(query: GetOddsQuery): Promise<ApiFootballOddsEnvelope>;
  getOddsMapping(query: GetOddsMappingQuery): Promise<ApiFootballOddsMappingEnvelope>;
  getOddsBookmakers(query: GetOddsBookmakersQuery): Promise<ApiFootballOddsBookmakersEnvelope>;
  getOddsBets(query: GetOddsBetsQuery): Promise<ApiFootballOddsBetsEnvelope>;
}

export class FootballService implements FootballServiceContract {
  constructor(private readonly client: FootballApiClientContract = footballApiClient) {}

  getCountries(query: GetCountriesQuery) {
    return this.client.getCountries(query);
  }

  getTimezone() {
    return this.client.getTimezone();
  }

  getLeagues(query: GetLeaguesQuery) {
    return this.client.getLeagues(query);
  }

  getLeagueSeasons() {
    return this.client.getLeagueSeasons();
  }

  getFixtures(query: GetFixturesQuery) {
    return this.client.getFixtures(query);
  }

  getFixtureRounds(query: GetFixtureRoundsQuery) {
    return this.client.getFixtureRounds(query);
  }

  getFixtureHeadToHead(query: GetFixtureHeadToHeadQuery) {
    return this.client.getFixtureHeadToHead(query);
  }

  getFixtureStatistics(query: GetFixtureStatisticsQuery) {
    return this.client.getFixtureStatistics(query);
  }

  getFixtureEvents(query: GetFixtureEventsQuery) {
    return this.client.getFixtureEvents(query);
  }

  getFixtureLineups(query: GetFixtureLineupsQuery) {
    return this.client.getFixtureLineups(query);
  }

  getFixturePlayers(query: GetFixturePlayersQuery) {
    return this.client.getFixturePlayers(query);
  }

  getTeams(query: GetTeamsQuery) {
    return this.client.getTeams(query);
  }

  getTeamStatistics(query: GetTeamStatisticsQuery) {
    return this.client.getTeamStatistics(query);
  }

  getTeamSeasons(query: GetTeamSeasonsQuery) {
    return this.client.getTeamSeasons(query);
  }

  getTeamCountries() {
    return this.client.getTeamCountries();
  }

  getVenues(query: GetVenuesQuery) {
    return this.client.getVenues(query);
  }

  getStandings(query: GetStandingsQuery) {
    return this.client.getStandings(query);
  }

  getInjuries(query: GetInjuriesQuery) {
    return this.client.getInjuries(query);
  }

  getPredictions(query: GetPredictionsQuery) {
    return this.client.getPredictions(query);
  }

  getCoachs(query: GetCoachsQuery) {
    return this.client.getCoachs(query);
  }

  getPlayersSeasons() {
    return this.client.getPlayersSeasons();
  }

  getPlayerProfiles(query: GetPlayerProfilesQuery) {
    return this.client.getPlayerProfiles(query);
  }

  getPlayers(query: GetPlayersQuery) {
    return this.client.getPlayers(query);
  }

  getPlayerSquads(query: GetPlayerSquadsQuery) {
    return this.client.getPlayerSquads(query);
  }

  getPlayerTeams(query: GetPlayerTeamsQuery) {
    return this.client.getPlayerTeams(query);
  }

  getPlayersTopScorers(query: GetTopPlayersQuery) {
    return this.client.getPlayersTopScorers(query);
  }

  getPlayersTopAssists(query: GetTopPlayersQuery) {
    return this.client.getPlayersTopAssists(query);
  }

  getPlayersTopYellowCards(query: GetTopPlayersQuery) {
    return this.client.getPlayersTopYellowCards(query);
  }

  getPlayersTopRedCards(query: GetTopPlayersQuery) {
    return this.client.getPlayersTopRedCards(query);
  }

  getTransfers(query: GetTransfersQuery) {
    return this.client.getTransfers(query);
  }

  getTrophies(query: GetTrophiesQuery) {
    return this.client.getTrophies(query);
  }

  getSidelined(query: GetSidelinedQuery) {
    return this.client.getSidelined(query);
  }

  getOddsLive(query: GetOddsLiveQuery) {
    return this.client.getOddsLive(query);
  }

  getOddsLiveBets(query: GetOddsLiveBetsQuery) {
    return this.client.getOddsLiveBets(query);
  }

  getOdds(query: GetOddsQuery) {
    return this.client.getOdds(query);
  }

  getOddsMapping(query: GetOddsMappingQuery) {
    return this.client.getOddsMapping(query);
  }

  getOddsBookmakers(query: GetOddsBookmakersQuery) {
    return this.client.getOddsBookmakers(query);
  }

  getOddsBets(query: GetOddsBetsQuery) {
    return this.client.getOddsBets(query);
  }
}

export const footballService = new FootballService();
