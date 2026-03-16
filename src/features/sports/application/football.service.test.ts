import { describe, expect, it } from "bun:test";
import type {
  ApiFootballCountriesEnvelope,
  ApiFootballTimezoneEnvelope,
} from "../domain/football.types";
import type { FootballApiClientContract } from "../infrastructure/football-api.client";
import { FootballService } from "./football.service";

function createClient(): FootballApiClientContract {
  return {
    getCountries: async () =>
      ({
        get: "countries",
        parameters: { name: "england" },
        errors: [],
        results: 1,
        paging: { current: 1, total: 1 },
        response: [{ name: "England", code: "GB", flag: "gb.svg" }],
      }) satisfies ApiFootballCountriesEnvelope,
    getTimezone: async () =>
      ({
        get: "timezone",
        parameters: {},
        errors: [],
        results: 1,
        response: ["UTC"],
      }) satisfies ApiFootballTimezoneEnvelope,
    getLeagues: async () => {
      throw new Error("not used");
    },
    getLeagueSeasons: async () => {
      throw new Error("not used");
    },
    getFixtures: async () => {
      throw new Error("not used");
    },
    getFixtureRounds: async () => {
      throw new Error("not used");
    },
    getFixtureHeadToHead: async () => {
      throw new Error("not used");
    },
    getFixtureStatistics: async () => {
      throw new Error("not used");
    },
    getFixtureEvents: async () => {
      throw new Error("not used");
    },
    getFixtureLineups: async () => {
      throw new Error("not used");
    },
    getFixturePlayers: async () => {
      throw new Error("not used");
    },
    getTeams: async () => {
      throw new Error("not used");
    },
    getTeamStatistics: async () => {
      throw new Error("not used");
    },
    getTeamSeasons: async () => {
      throw new Error("not used");
    },
    getTeamCountries: async () => {
      throw new Error("not used");
    },
    getVenues: async () => {
      throw new Error("not used");
    },
    getStandings: async () => {
      throw new Error("not used");
    },
    getInjuries: async () => {
      throw new Error("not used");
    },
    getPredictions: async () => {
      throw new Error("not used");
    },
    getCoachs: async () => {
      throw new Error("not used");
    },
    getPlayersSeasons: async () => {
      throw new Error("not used");
    },
    getPlayerProfiles: async () => {
      throw new Error("not used");
    },
    getPlayers: async () => {
      throw new Error("not used");
    },
    getPlayerSquads: async () => {
      throw new Error("not used");
    },
    getPlayerTeams: async () => {
      throw new Error("not used");
    },
    getPlayersTopScorers: async () => {
      throw new Error("not used");
    },
    getPlayersTopAssists: async () => {
      throw new Error("not used");
    },
    getPlayersTopYellowCards: async () => {
      throw new Error("not used");
    },
    getPlayersTopRedCards: async () => {
      throw new Error("not used");
    },
    getTransfers: async () => {
      throw new Error("not used");
    },
    getTrophies: async () => {
      throw new Error("not used");
    },
    getSidelined: async () => {
      throw new Error("not used");
    },
    getOddsLive: async () => {
      throw new Error("not used");
    },
    getOddsLiveBets: async () => {
      throw new Error("not used");
    },
    getOdds: async () => {
      throw new Error("not used");
    },
    getOddsMapping: async () => {
      throw new Error("not used");
    },
    getOddsBookmakers: async () => {
      throw new Error("not used");
    },
    getOddsBets: async () => {
      throw new Error("not used");
    },
  };
}

describe("football.service", () => {
  it("proxy de timezone delega en el cliente", async () => {
    const service = new FootballService(createClient());

    const result = await service.getTimezone();

    expect(result.response).toEqual(["UTC"]);
  });

  it("proxy de countries delega en el cliente", async () => {
    const service = new FootballService(createClient());

    const result = await service.getCountries({ name: "england" });

    expect(result.response).toEqual([{ name: "England", code: "GB", flag: "gb.svg" }]);
  });
});
