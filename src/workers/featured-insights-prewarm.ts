const DEFAULT_TIMEZONE = "UTC";

const FEATURED_PRIMARY_COUNTRY_TIMEZONE_RULES: Array<{ prefixes: string[]; country: string }> = [
  { prefixes: ["America/Bogota"], country: "Colombia" },
  { prefixes: ["America/Argentina/"], country: "Argentina" },
  {
    prefixes: ["America/Sao_Paulo", "America/Fortaleza", "America/Belem", "America/Bahia"],
    country: "Brazil",
  },
  {
    prefixes: [
      "America/Mexico_City",
      "America/Monterrey",
      "America/Tijuana",
      "America/Merida",
      "America/Cancun",
      "America/Chihuahua",
      "America/Ojinaga",
      "America/Mazatlan",
    ],
    country: "Mexico",
  },
  {
    prefixes: [
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Los_Angeles",
      "America/Phoenix",
      "America/Detroit",
      "America/Indiana/",
      "America/Boise",
      "America/Anchorage",
      "Pacific/Honolulu",
    ],
    country: "USA",
  },
  { prefixes: ["America/Santiago"], country: "Chile" },
  { prefixes: ["America/Montevideo"], country: "Uruguay" },
  { prefixes: ["America/Asuncion"], country: "Paraguay" },
  { prefixes: ["America/Guayaquil"], country: "Ecuador" },
  { prefixes: ["America/Lima"], country: "Peru" },
  { prefixes: ["America/La_Paz"], country: "Bolivia" },
  { prefixes: ["America/Caracas"], country: "Venezuela" },
  { prefixes: ["America/Costa_Rica"], country: "Costa Rica" },
  { prefixes: ["America/Tegucigalpa"], country: "Honduras" },
  { prefixes: ["America/Guatemala"], country: "Guatemala" },
  { prefixes: ["America/El_Salvador"], country: "El Salvador" },
  { prefixes: ["America/Panama"], country: "Panama" },
  { prefixes: ["America/Managua"], country: "Nicaragua" },
  { prefixes: ["America/Santo_Domingo"], country: "Dominican Republic" },
  {
    prefixes: ["America/Toronto", "America/Vancouver", "America/Edmonton", "America/Winnipeg"],
    country: "Canada",
  },
  { prefixes: ["Europe/London"], country: "England" },
  { prefixes: ["Europe/Madrid"], country: "Spain" },
  { prefixes: ["Europe/Berlin"], country: "Germany" },
  { prefixes: ["Europe/Rome"], country: "Italy" },
  { prefixes: ["Europe/Paris"], country: "France" },
  { prefixes: ["Europe/Lisbon"], country: "Portugal" },
  { prefixes: ["Europe/Amsterdam"], country: "Netherlands" },
  { prefixes: ["Europe/Brussels"], country: "Belgium" },
  { prefixes: ["Europe/Istanbul"], country: "Turkey" },
  { prefixes: ["Europe/Athens"], country: "Greece" },
];

export function getCountryForTimezone(timezone: string): string | null {
  const match = FEATURED_PRIMARY_COUNTRY_TIMEZONE_RULES.find((rule) =>
    rule.prefixes.some((prefix) => timezone === prefix || timezone.startsWith(prefix))
  );

  return match?.country ?? null;
}

export function getDateRangeForTimezone(timeZone: string, pastDays: number, futureDays: number): string[] {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const seen = new Set<string>();
  const dates: string[] = [];
  const dayMs = 24 * 60 * 60 * 1000;
  const base = Date.now();
  for (let offset = -pastDays; offset <= futureDays; offset++) {
    const ymd = formatter.format(new Date(base + offset * dayMs));
    if (!seen.has(ymd)) {
      seen.add(ymd);
      dates.push(ymd);
    }
  }
  return dates;
}

export function getFeaturedInsightsPrewarmVariants(timezones: string[]) {
  const normalized = Array.from(
    new Set(
      timezones
        .map((timezone) => timezone.trim())
        .filter((timezone) => Boolean(timezone) && timezone !== DEFAULT_TIMEZONE)
    )
  );
  return [
    { timezone: DEFAULT_TIMEZONE, userCountry: null as string | null, label: "global" },
    ...normalized.map((timezone) => {
      const userCountry = getCountryForTimezone(timezone);
      return {
        timezone,
        userCountry,
        label: `${timezone}:${userCountry ?? "global"}`,
      };
    }),
  ];
}
