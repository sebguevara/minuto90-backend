/**
 * Cliente HTTP para la API de Football (api-sports.io)
 */

const FOOTBALL_API_URL = process.env.FOOTBALL_API_URL || "https://v3.football.api-sports.io";
const API_KEY = process.env.API_KEY || "";

interface ApiResponse<T> {
  get: string;
  parameters: Record<string, any>;
  errors: any[];
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: T;
}

export interface Season {
  year: number;
  start: string;
  end: string;
  current: boolean;
  coverage: {
    fixtures: {
      events: boolean;
      lineups: boolean;
      statistics_fixtures: boolean;
      statistics_players: boolean;
    };
    standings: boolean;
    players: boolean;
    top_scorers: boolean;
    top_assists: boolean;
    top_cards: boolean;
    injuries: boolean;
    predictions: boolean;
    odds: boolean;
  };
}

export interface LeagueResponse {
  league: {
    id: number;
    name: string;
    type: string;
    logo: string;
  };
  country: {
    name: string;
    code: string;
    flag: string;
  };
  seasons: Season[];
}

export interface FixtureResponse {
  fixture: {
    id: number;
    referee: string | null;
    timezone: string;
    date: string;
    timestamp: number;
    periods: {
      first: number | null;
      second: number | null;
    };
    venue: {
      id: number | null;
      name: string | null;
      city: string | null;
    };
    status: {
      long: string;
      short: string;
      elapsed: number | null;
    };
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
    season: number;
    round: string;
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
    away: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score: {
    halftime: {
      home: number | null;
      away: number | null;
    };
    fulltime: {
      home: number | null;
      away: number | null;
    };
    extratime: {
      home: number | null;
      away: number | null;
    };
    penalty: {
      home: number | null;
      away: number | null;
    };
  };
}

/**
 * Cliente para hacer peticiones a la API de Football
 */
class FootballApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = FOOTBALL_API_URL;
    this.apiKey = API_KEY;
  }

  private async request<T>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    const url = new URL(`${this.baseUrl}${endpoint}`);

    if (params) {
      Object.keys(params).forEach((key) => {
        if (params[key] !== undefined && params[key] !== null) {
          url.searchParams.append(key, params[key].toString());
        }
      });
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "x-rapidapi-key": this.apiKey,
        "x-rapidapi-host": "v3.football.api-sports.io",
      },
    });

    if (!response.ok) {
      throw new Error(`Football API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Obtiene información de una liga incluyendo todas sus temporadas
   */
  async getLeague(leagueId: number): Promise<LeagueResponse[]> {
    const result = await this.request<LeagueResponse[]>("/leagues", { id: leagueId });
    return result.response;
  }

  /**
   * Obtiene la temporada actual de una liga
   */
  async getCurrentSeason(leagueId: number): Promise<Season | null> {
    const leagues = await this.getLeague(leagueId);

    if (!leagues || leagues.length === 0) {
      return null;
    }

    const currentSeason = leagues[0].seasons.find((season) => season.current);
    return currentSeason || null;
  }

  /**
   * Obtiene los fixtures (partidos) de un equipo
   */
  async getTeamFixtures(params: {
    team: number;
    season: number;
    league?: number;
    last?: number;
    next?: number;
    from?: string;
    to?: string;
    status?: string;
  }): Promise<FixtureResponse[]> {
    const result = await this.request<FixtureResponse[]>("/fixtures", params);
    return result.response;
  }

  /**
   * Obtiene un fixture específico por ID
   */
  async getFixtureById(fixtureId: number): Promise<FixtureResponse | null> {
    const result = await this.request<FixtureResponse[]>("/fixtures", { id: fixtureId });
    return result.response && result.response.length > 0 ? result.response[0] : null;
  }

  /**
   * Obtiene estadísticas de un equipo en una temporada
   */
  async getTeamStatistics(params: {
    team: number;
    season: number;
    league: number;
  }): Promise<any> {
    const result = await this.request<any>("/teams/statistics", params);
    return result.response;
  }
}

export const footballApiClient = new FootballApiClient();
