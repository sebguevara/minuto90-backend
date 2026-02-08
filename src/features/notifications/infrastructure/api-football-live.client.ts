const FOOTBALL_API_URL =
  process.env.FOOTBALL_API_URL ?? "https://v3.football.api-sports.io";

// Backwards compatible with existing code that uses `API_KEY`.
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY ?? process.env.API_KEY ?? "";

export type ApiFootballFixtureStatusShort =
  | "NS"
  | "1H"
  | "HT"
  | "2H"
  | "ET"
  | "BT"
  | "P"
  | "FT"
  | "AET"
  | "PEN"
  | "SUSP"
  | "INT"
  | "PST"
  | "CANC"
  | "ABD"
  | "AWD"
  | "WO"
  | "LIVE"
  | string;

export type ApiFootballFixtureEvent = {
  time?: { elapsed?: number | null; extra?: number | null };
  team?: { id?: number | null; name?: string | null };
  player?: { id?: number | null; name?: string | null };
  assist?: { id?: number | null; name?: string | null };
  type?: string | null; // "Goal", "Card", etc.
  detail?: string | null; // "Red Card", etc.
  comments?: string | null;
};

export type ApiFootballLiveFixture = {
  fixture: {
    id: number;
    date?: string;
    status: { short: ApiFootballFixtureStatusShort; elapsed?: number | null };
  };
  league?: { name?: string | null };
  teams?: {
    home?: { name?: string | null };
    away?: { name?: string | null };
  };
  goals?: { home?: number | null; away?: number | null };
  score?: unknown;
  events?: ApiFootballFixtureEvent[];
};

type ApiResponse<T> = {
  response: T;
  errors?: unknown;
  results?: number;
};

export class ApiFootballLiveClient {
  constructor(
    private readonly baseUrl: string = FOOTBALL_API_URL,
    private readonly apiKey: string = FOOTBALL_API_KEY
  ) {}

  async listLiveFixtures(): Promise<ApiFootballLiveFixture[]> {
    if (!this.apiKey) {
      throw new Error("Missing API-Football key (set FOOTBALL_API_KEY or API_KEY).");
    }

    const url = new URL(`${this.baseUrl}/fixtures`);
    url.searchParams.set("live", "all");

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "x-rapidapi-key": this.apiKey,
        "x-rapidapi-host": "v3.football.api-sports.io",
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `API-Football live fixtures error: ${res.status} ${res.statusText}${body ? ` - ${body}` : ""}`
      );
    }

    const json = (await res.json()) as ApiResponse<ApiFootballLiveFixture[]>;
    return Array.isArray(json?.response) ? json.response : [];
  }
}

export const apiFootballLiveClient = new ApiFootballLiveClient();

