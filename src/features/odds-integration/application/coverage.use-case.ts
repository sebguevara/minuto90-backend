import { footballService } from "../../sports/application/football.service";
import type {
  ApiFootballFixtureItem,
  GetFixturesQuery,
} from "../../sports/domain/football.types";
import { kickertechDiscoveryService } from "../../kickertech/application/kickertech-discovery.service";
import { createOddsIntegrationValidationError } from "../domain/odds-integration.errors";
import type {
  MatcherCandidate,
  OddsSource,
} from "../domain/odds-integration.types";
import {
  eventMatcherService,
  type EventMatcherServiceContract,
} from "./event-matcher.service";
import {
  eventMappingRepository,
  type EventMappingRepository,
} from "../infrastructure/event-mapping.repository";
import {
  tournamentMappingRepository,
  type TournamentMappingRepository,
} from "../infrastructure/tournament-mapping.repository";

/**
 * Reporte de cobertura: para una liga + fecha, cuáles fixtures tienen mapping
 * de evento (resuelto o resoluble) y cuáles no. Útil para diagnosticar drift,
 * decidir aliases nuevos, o validar el seed inicial.
 *
 * Modo `dry-run`: NO persiste mappings nuevos — sólo simula qué pasaría.
 */
export interface CoverageItem {
  fixtureId: number;
  date: string;
  home: string;
  away: string;
  status: "mapped" | "would_match" | "unmatched";
  externalEventId?: number;
  confidence?: number;
  matchedBy?: "exact" | "alias" | "fuzzy" | "manual";
  reason?: string;
}

export interface CoverageReport {
  leagueId: number;
  season: number;
  date: string;
  total: number;
  mapped: number;
  wouldMatch: number;
  unmatched: number;
  unmappedTournament: boolean;
  items: CoverageItem[];
}

export interface CoverageUseCaseDeps {
  tournamentRepo?: TournamentMappingRepository;
  eventRepo?: EventMappingRepository;
  matcher?: EventMatcherServiceContract;
  fixturesProvider?: { getFixtures: (query: GetFixturesQuery) => Promise<ApiFootballFixtureItem[]> };
  candidateProvider?: {
    getEvents: (
      sportId: number,
      countryId: number,
      tournamentId: number
    ) => Promise<MatcherCandidate[]>;
  };
}

const DEFAULT_SOURCE: OddsSource = "kickertech";

const defaultFixturesProvider = {
  async getFixtures(query: GetFixturesQuery) {
    const envelope = await footballService.getFixtures(query);
    return envelope.response;
  },
};

const defaultCandidateProvider = {
  async getEvents(sportId: number, countryId: number, tournamentId: number) {
    const events = await kickertechDiscoveryService.getEvents(sportId, countryId, tournamentId);
    return events.map<MatcherCandidate>((event) => ({
      externalEventId: event.id,
      home: event.home,
      away: event.away,
      dateStart: event.dateStart,
    }));
  },
};

export class CoverageUseCase {
  private readonly tournamentRepo: TournamentMappingRepository;
  private readonly eventRepo: EventMappingRepository;
  private readonly matcher: EventMatcherServiceContract;
  private readonly fixturesProvider: NonNullable<CoverageUseCaseDeps["fixturesProvider"]>;
  private readonly candidateProvider: NonNullable<CoverageUseCaseDeps["candidateProvider"]>;

  constructor(deps: CoverageUseCaseDeps = {}) {
    this.tournamentRepo = deps.tournamentRepo ?? tournamentMappingRepository;
    this.eventRepo = deps.eventRepo ?? eventMappingRepository;
    this.matcher = deps.matcher ?? eventMatcherService;
    this.fixturesProvider = deps.fixturesProvider ?? defaultFixturesProvider;
    this.candidateProvider = deps.candidateProvider ?? defaultCandidateProvider;
  }

  async execute(input: {
    leagueId: number;
    season: number;
    date: string;
  }): Promise<CoverageReport> {
    if (!Number.isInteger(input.leagueId) || input.leagueId <= 0) {
      throw createOddsIntegrationValidationError(
        "El parámetro leagueId debe ser un número entero válido"
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      throw createOddsIntegrationValidationError(
        "El parámetro date debe tener formato YYYY-MM-DD"
      );
    }

    const tournamentMapping = await this.tournamentRepo.findByApifootballLeague(
      DEFAULT_SOURCE,
      input.leagueId,
      input.season
    );

    const fixtures = await this.fixturesProvider.getFixtures({
      league: input.leagueId,
      season: input.season,
      date: input.date,
    });

    if (!tournamentMapping) {
      return {
        leagueId: input.leagueId,
        season: input.season,
        date: input.date,
        total: fixtures.length,
        mapped: 0,
        wouldMatch: 0,
        unmatched: fixtures.length,
        unmappedTournament: true,
        items: fixtures.map((fixture) => ({
          fixtureId: fixture.fixture.id,
          date: fixture.fixture.date,
          home: fixture.teams.home.name,
          away: fixture.teams.away.name,
          status: "unmatched",
          reason: "tournament_not_mapped",
        })),
      };
    }

    const candidates = await this.candidateProvider.getEvents(
      tournamentMapping.sportId,
      tournamentMapping.countryId,
      tournamentMapping.tournamentId
    );

    const items: CoverageItem[] = [];
    let mapped = 0;
    let wouldMatch = 0;
    let unmatched = 0;

    for (const fixture of fixtures) {
      const fixtureId = fixture.fixture.id;
      const persisted = await this.eventRepo.findByFixtureId(DEFAULT_SOURCE, fixtureId);

      if (persisted) {
        mapped += 1;
        items.push({
          fixtureId,
          date: fixture.fixture.date,
          home: fixture.teams.home.name,
          away: fixture.teams.away.name,
          status: "mapped",
          externalEventId: persisted.externalEventId,
          confidence: persisted.confidence,
          matchedBy: persisted.matchedBy,
        });
        continue;
      }

      const matchResult = await this.matcher.match({
        source: DEFAULT_SOURCE,
        sportId: tournamentMapping.sportId,
        fixture: {
          fixtureId,
          date: fixture.fixture.date,
          leagueId: fixture.league.id,
          season: fixture.league.season,
          home: { id: fixture.teams.home.id ?? null, name: fixture.teams.home.name ?? "" },
          away: { id: fixture.teams.away.id ?? null, name: fixture.teams.away.name ?? "" },
        },
        candidates,
      });

      if (matchResult.matched) {
        wouldMatch += 1;
        items.push({
          fixtureId,
          date: fixture.fixture.date,
          home: fixture.teams.home.name,
          away: fixture.teams.away.name,
          status: "would_match",
          externalEventId: matchResult.externalEventId,
          confidence: matchResult.confidence,
          matchedBy: matchResult.matchedBy,
        });
      } else {
        unmatched += 1;
        items.push({
          fixtureId,
          date: fixture.fixture.date,
          home: fixture.teams.home.name,
          away: fixture.teams.away.name,
          status: "unmatched",
          confidence: matchResult.bestConfidence,
          reason: matchResult.reason,
        });
      }
    }

    return {
      leagueId: input.leagueId,
      season: input.season,
      date: input.date,
      total: fixtures.length,
      mapped,
      wouldMatch,
      unmatched,
      unmappedTournament: false,
      items,
    };
  }
}

export const coverageUseCase = new CoverageUseCase();
