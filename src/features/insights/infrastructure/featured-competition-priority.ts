import {
  HOME_FEATURED_COMPETITIONS,
  INTERNATIONAL_COMPETITION_IDS,
  leaguePriority,
} from "./featured-competitions.constants";

export type FeaturedCompetitionGroup =
  | "user_country"
  | "international"
  | "europe"
  | "latin_america"
  | "other";

const INTERNATIONAL_COUNTRIES = new Set([
  "World",
  "Europe",
  "Asia",
  "Africa",
  "America",
  "South America",
  "North America",
  "Oceania",
  "International",
]);

const EUROPE_COUNTRIES = new Set([
  "England",
  "Spain",
  "Germany",
  "Italy",
  "France",
  "Portugal",
  "Netherlands",
  "Belgium",
  "Turkey",
  "Greece",
  "Scotland",
  "Ireland",
  "Wales",
  "Croatia",
  "Serbia",
  "Switzerland",
  "Austria",
  "Czech-Republic",
  "Czech Republic",
  "Poland",
  "Denmark",
  "Norway",
  "Sweden",
  "Finland",
  "Romania",
  "Bulgaria",
  "Ukraine",
  "Russia",
  "Hungary",
  "Slovakia",
  "Slovenia",
]);

const LATIN_AMERICA_COUNTRIES = new Set([
  "Argentina",
  "Bolivia",
  "Brazil",
  "Chile",
  "Colombia",
  "Costa Rica",
  "Ecuador",
  "El Salvador",
  "Guatemala",
  "Honduras",
  "Mexico",
  "Nicaragua",
  "Panama",
  "Paraguay",
  "Peru",
  "Uruguay",
  "Venezuela",
  "Dominican Republic",
]);

function normalizeCountry(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function countryMatches(leagueCountry: string | null | undefined, userCountry: string | null | undefined) {
  const normalizedLeagueCountry = normalizeCountry(leagueCountry);
  const normalizedUserCountry = normalizeCountry(userCountry);

  if (!normalizedLeagueCountry || !normalizedUserCountry) return false;
  if (normalizedLeagueCountry === normalizedUserCountry) return true;

  const aliases: Record<string, string[]> = {
    usa: ["united states", "united states of america", "us"],
    "united states": ["usa", "united states of america", "us"],
    "dominican republic": ["rep dominicana", "republica dominicana"],
    "republica dominicana": ["rep dominicana", "dominican republic"],
  };

  const leagueAliases = aliases[normalizedLeagueCountry] ?? [];
  const userAliases = aliases[normalizedUserCountry] ?? [];
  return (
    leagueAliases.includes(normalizedUserCountry) || userAliases.includes(normalizedLeagueCountry)
  );
}

const FEATURED_COMPETITION_IDS = new Set(HOME_FEATURED_COMPETITIONS.map((competition) => competition.id));
const FEATURED_COMPETITION_TYPE = new Map(
  HOME_FEATURED_COMPETITIONS.map((competition) => [competition.id, competition.type])
);
const LEAGUE_PRIORITY = new Map(
  Object.entries(leaguePriority).map(([competitionId, priority]) => [Number(competitionId), priority])
);

export function getFeaturedLeaguePriority(leagueId: number) {
  return LEAGUE_PRIORITY.get(leagueId) ?? null;
}

export function isFeaturedCompetitionId(leagueId: number) {
  return FEATURED_COMPETITION_IDS.has(leagueId);
}

export function getFeaturedCompetitionType(leagueId: number): "League" | "Cup" | null {
  const type = FEATURED_COMPETITION_TYPE.get(leagueId);
  return type === "League" || type === "Cup" ? type : null;
}

function getGroupByPriority(priority: number | null): FeaturedCompetitionGroup | null {
  if (priority === null) return null;
  if (priority <= 20) return "international";
  if (priority <= 50) return "europe";
  if (priority <= 100) return "latin_america";
  return "other";
}

export function getFeaturedCompetitionGroup(input: {
  leagueId: number;
  leagueCountry: string | null | undefined;
  userCountry?: string | null;
}): FeaturedCompetitionGroup {
  // International competitions by explicit ID set (Champions, Libertadores, etc.)
  // This MUST be checked FIRST — these competitions are always "international"
  // regardless of user country or API-Football country field.
  if (INTERNATIONAL_COMPETITION_IDS.has(input.leagueId)) {
    return "international";
  }

  // User's home country for domestic competitions
  if (countryMatches(input.leagueCountry, input.userCountry)) {
    return "user_country";
  }

  // Priority-based grouping for domestic competitions
  const priority = getFeaturedLeaguePriority(input.leagueId);
  const groupedByPriority = getGroupByPriority(priority);
  if (groupedByPriority) {
    return groupedByPriority;
  }

  if (EUROPE_COUNTRIES.has(input.leagueCountry ?? "")) {
    return "europe";
  }

  if (LATIN_AMERICA_COUNTRIES.has(input.leagueCountry ?? "")) {
    return "latin_america";
  }

  return "other";
}
