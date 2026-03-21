import type { FetchConfig } from "../types/config.js";
import type { PlayerStats, PlayerTokensParams } from "../types/player.js";
import type { Token, PaginatedResult } from "../types/token.js";
import { apiFetch, buildQueryString } from "./base.js";
import { mapPaginatedTokens, mapPlayerStats } from "../utils/mappers.js";

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
    sort_by: params?.sort?.field,
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
