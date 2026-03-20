export type MatchUrlInput = {
  fixtureId: number;
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
};

function baseUrl() {
  const raw = process.env.MINUTO90_WEB_BASE_URL ?? "https://minuto90score.com";
  return raw.replace(/\/+$/g, "");
}

export function buildMatchUrl(input: MatchUrlInput) {
  return `${baseUrl()}/p/${input.fixtureId}`;
}
