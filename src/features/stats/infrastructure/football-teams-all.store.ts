import { logWarn } from '../../../shared/logging/logger';
import { redisConnection } from '../../../shared/redis/redis.connection';

export interface FootballTeamRef {
  id: number;   // API-Football team ID = Team.minId in DB
  logo: string;
}

const REDIS_KEY = 'football:teams:all';
const TTL_24H = 60 * 60 * 24;

export async function getFootballTeamsAll(): Promise<FootballTeamRef[] | null> {
  try {
    const raw = await redisConnection.get(REDIS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FootballTeamRef[];
  } catch (err) {
    logWarn('football_teams_all.get_failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function setFootballTeamsAll(teams: FootballTeamRef[]): Promise<void> {
  if (!teams.length) return;
  try {
    await redisConnection.set(REDIS_KEY, JSON.stringify(teams), 'EX', TTL_24H);
  } catch (err) {
    logWarn('football_teams_all.set_failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
