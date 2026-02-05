import * as repo from "../infrastructure/stats.repo";
import type { TeamPlayerTableQuery, TeamTableQuery } from "../dtos/stats.dto";
import { getTeamByMinId } from "./stats.service";

export async function getTeamDefensiveTableByMinId(
  minId: number,
  query: TeamTableQuery
) {
  const team = await getTeamByMinId(minId);
  const result = await repo.listTeamTableDefensive(team.id, query);
  return {
    data: result.items,
    meta: { limit: query.limit, offset: query.offset, count: result.total },
  };
}

export async function getTeamOffensiveTableByMinId(
  minId: number,
  query: TeamTableQuery
) {
  const team = await getTeamByMinId(minId);
  const result = await repo.listTeamTableOffensive(team.id, query);
  return {
    data: result.items,
    meta: { limit: query.limit, offset: query.offset, count: result.total },
  };
}

export async function getTeamSummaryTableByMinId(
  minId: number,
  query: TeamTableQuery
) {
  const team = await getTeamByMinId(minId);
  const result = await repo.listTeamTableSummary(team.id, query);
  return {
    data: result.items,
    meta: { limit: query.limit, offset: query.offset, count: result.total },
  };
}

export async function getTeamXGTableByMinId(minId: number, query: TeamTableQuery) {
  const team = await getTeamByMinId(minId);
  const result = await repo.listTeamTableXG(team.id, query);
  return {
    data: result.items,
    meta: { limit: query.limit, offset: query.offset, count: result.total },
  };
}

export async function getTeamPlayerDefensiveTableByMinId(
  minId: number,
  query: TeamPlayerTableQuery
) {
  const team = await getTeamByMinId(minId);
  const result = await repo.listTeamPlayerTableDefensive(team.id, query);
  return {
    data: result.items,
    meta: { limit: query.limit, offset: query.offset, count: result.total },
  };
}

export async function getTeamPlayerOffensiveTableByMinId(
  minId: number,
  query: TeamPlayerTableQuery
) {
  const team = await getTeamByMinId(minId);
  const result = await repo.listTeamPlayerTableOffensive(team.id, query);
  return {
    data: result.items,
    meta: { limit: query.limit, offset: query.offset, count: result.total },
  };
}

export async function getTeamPlayerPassingTableByMinId(
  minId: number,
  query: TeamPlayerTableQuery
) {
  const team = await getTeamByMinId(minId);
  const result = await repo.listTeamPlayerTablePassing(team.id, query);
  return {
    data: result.items,
    meta: { limit: query.limit, offset: query.offset, count: result.total },
  };
}

export async function getTeamPlayerSummaryTableByMinId(
  minId: number,
  query: TeamPlayerTableQuery
) {
  const team = await getTeamByMinId(minId);
  const result = await repo.listTeamPlayerTableSummary(team.id, query);
  return {
    data: result.items,
    meta: { limit: query.limit, offset: query.offset, count: result.total },
  };
}

export async function getTeamPlayerXGTableByMinId(
  minId: number,
  query: TeamPlayerTableQuery
) {
  const team = await getTeamByMinId(minId);
  const result = await repo.listTeamPlayerTableXG(team.id, query);
  return {
    data: result.items,
    meta: { limit: query.limit, offset: query.offset, count: result.total },
  };
}

