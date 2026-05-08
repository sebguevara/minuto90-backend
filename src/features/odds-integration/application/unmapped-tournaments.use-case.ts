import { footballService } from "../../sports/application/football.service";
import { kickertechDiscoveryService } from "../../kickertech/application/kickertech-discovery.service";
import type {
  OddsSource,
  OddsTournamentMappingRecord,
} from "../domain/odds-integration.types";
import { normalizeTeamName } from "../infrastructure/normalize-team-name";
import {
  tournamentMappingRepository,
  type TournamentMappingRepository,
} from "../infrastructure/tournament-mapping.repository";

/**
 * Lista los torneos de Kickertech (en un sport+country) que NO tienen mapping,
 * junto con sugerencias automáticas de a qué league de api-football podrían
 * corresponder, ordenadas por similitud de nombre.
 *
 * Pensado para alimentar el panel admin (o CLI interactivo). El admin elige
 * y dispara `oddsMappingAdminService.upsertTournamentMapping`.
 */
export interface UnmappedTournamentSuggestion {
  apifootballLeagueId: number;
  apifootballLeagueName: string;
  apifootballCountryName: string;
  similarity: number;
}

export interface UnmappedTournamentItem {
  source: OddsSource;
  sportId: number;
  countryId: number;
  tournamentId: number;
  tournamentName: string;
  suggestions: UnmappedTournamentSuggestion[];
}

export interface UnmappedTournamentsUseCaseDeps {
  tournamentRepo?: TournamentMappingRepository;
  candidateProvider?: {
    getTournaments: (sportId: number, countryIds: number[]) => Promise<
      Array<{ id: number; name: string }>
    >;
  };
  leaguesProvider?: {
    /** api-football leagues filtradas por país. Devuelve {id, name, country}. */
    getLeagues: (
      apifootballCountry: string
    ) => Promise<Array<{ id: number; name: string; country: string }>>;
  };
}

const DEFAULT_SOURCE: OddsSource = "kickertech";

const defaultCandidateProvider = {
  async getTournaments(sportId: number, countryIds: number[]) {
    return kickertechDiscoveryService.getTournaments(sportId, countryIds);
  },
};

const defaultLeaguesProvider = {
  async getLeagues(apifootballCountry: string) {
    const envelope = await footballService.getLeagues({ country: apifootballCountry });
    return envelope.response.map((item) => ({
      id: item.league.id,
      name: item.league.name,
      country: item.country?.name ?? "",
    }));
  },
};

const computeSimilarity = (left: string, right: string): number => {
  if (!left || !right) return 0;
  if (left === right) return 1;

  const a = new Set(left.split(" ").filter(Boolean));
  const b = new Set(right.split(" ").filter(Boolean));
  if (!a.size || !b.size) return 0;

  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const jaccard = intersection / (a.size + b.size - intersection);

  // Boost si uno está contenido en el otro (ej "Premier" vs "Premier League").
  if (left.includes(right) || right.includes(left)) {
    return Math.min(1, jaccard + 0.25);
  }
  return jaccard;
};

const buildSuggestions = (
  tournamentName: string,
  leagues: Array<{ id: number; name: string; country: string }>,
  topN: number
): UnmappedTournamentSuggestion[] => {
  const normalizedTournament = normalizeTeamName(tournamentName);
  return leagues
    .map((league) => ({
      apifootballLeagueId: league.id,
      apifootballLeagueName: league.name,
      apifootballCountryName: league.country,
      similarity: computeSimilarity(normalizedTournament, normalizeTeamName(league.name)),
    }))
    .filter((entry) => entry.similarity > 0)
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, topN);
};

export class UnmappedTournamentsUseCase {
  private readonly tournamentRepo: TournamentMappingRepository;
  private readonly candidateProvider: NonNullable<UnmappedTournamentsUseCaseDeps["candidateProvider"]>;
  private readonly leaguesProvider: NonNullable<UnmappedTournamentsUseCaseDeps["leaguesProvider"]>;

  constructor(deps: UnmappedTournamentsUseCaseDeps = {}) {
    this.tournamentRepo = deps.tournamentRepo ?? tournamentMappingRepository;
    this.candidateProvider = deps.candidateProvider ?? defaultCandidateProvider;
    this.leaguesProvider = deps.leaguesProvider ?? defaultLeaguesProvider;
  }

  async execute(input: {
    sportId: number;
    countryId: number;
    apifootballCountryName: string;
    suggestionsPerTournament?: number;
  }): Promise<UnmappedTournamentItem[]> {
    const topN = input.suggestionsPerTournament ?? 3;

    const [tournaments, mapped, leagues] = await Promise.all([
      this.candidateProvider.getTournaments(input.sportId, [input.countryId]),
      this.tournamentRepo.listBySportAndCountry(
        DEFAULT_SOURCE,
        input.sportId,
        input.countryId
      ),
      this.leaguesProvider.getLeagues(input.apifootballCountryName),
    ]);

    const mappedSet = new Set<number>(
      mapped.map((mapping: OddsTournamentMappingRecord) => mapping.tournamentId)
    );

    const unmapped = tournaments.filter((tournament) => !mappedSet.has(tournament.id));

    return unmapped.map((tournament) => ({
      source: DEFAULT_SOURCE,
      sportId: input.sportId,
      countryId: input.countryId,
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      suggestions: buildSuggestions(tournament.name, leagues, topN),
    }));
  }
}

export const unmappedTournamentsUseCase = new UnmappedTournamentsUseCase();
