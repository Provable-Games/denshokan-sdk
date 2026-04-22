import type { FetchConfig } from "../types/config.js";
import type { PlayerStats, PlayerTokensParams } from "../types/player.js";
import type { Token, TokenRank, PlayerRankParams, PaginatedResult } from "../types/token.js";
import { apiFetch, buildQueryString } from "./base.js";
import { SORT_FIELD_TO_API } from "./tokens.js";
import { mapPaginatedTokens, mapPlayerStats, mapTokenRank } from "../utils/mappers.js";

interface ApiContext {
  baseUrl: string;
  fetchConfig?: Partial<FetchConfig>;
}

export async function apiGetPlayerTokens(
  ctx: ApiContext,
  address: string,
  params?: PlayerTokensParams,
  signal?: AbortSignal,
): Promise<PaginatedResult<Token>> {
  const qs = buildQueryString({
    game_id: params?.gameId,
    sort_by: params?.sort?.field ? SORT_FIELD_TO_API[params.sort.field] : undefined,
    sort_order: params?.sort?.direction,
    limit: params?.limit,
    offset: params?.offset,
  });
  const raw = await apiFetch<{ data: Record<string, unknown>[]; total: number }>({
    baseUrl: ctx.baseUrl,
    path: `/players/${address}/tokens${qs}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return mapPaginatedTokens(raw);
}

export async function apiGetPlayerBestRank(
  ctx: ApiContext,
  address: string,
  params?: PlayerRankParams,
  signal?: AbortSignal,
): Promise<TokenRank> {
  const qs = buildQueryString({
    game_id: params?.gameId,
    settings_id: params?.settingsId,
    objective_id: params?.objectiveId,
    context_id: params?.contextId,
    context_name: params?.contextName,
    minter_address: params?.minterAddress,
    game_over: params?.gameOver,
    min_score: params?.minScore !== undefined ? params.minScore.toString() : undefined,
    max_score: params?.maxScore !== undefined ? params.maxScore.toString() : undefined,
  });
  const result = await apiFetch<{ data: Record<string, unknown> }>({
    baseUrl: ctx.baseUrl,
    path: `/players/${address}/rank${qs}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return mapTokenRank(result.data);
}

export async function apiGetPlayerStats(
  ctx: ApiContext,
  address: string,
  signal?: AbortSignal,
): Promise<PlayerStats> {
  const result = await apiFetch<{ data: Record<string, unknown> }>({
    baseUrl: ctx.baseUrl,
    path: `/players/${address}/stats`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return mapPlayerStats(result.data);
}
