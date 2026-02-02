import type { FetchConfig } from "../types/config.js";
import type { PlayerStats, PlayerTokensParams } from "../types/player.js";
import type { Token, PaginatedResult } from "../types/token.js";
import { apiFetch, buildQueryString } from "./base.js";

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
    game_id: params?.game_id,
    limit: params?.limit,
    offset: params?.offset,
  });
  return apiFetch<PaginatedResult<Token>>({
    baseUrl: ctx.baseUrl,
    path: `/players/${address}/tokens${qs}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
}

export async function apiGetPlayerStats(
  ctx: ApiContext,
  address: string,
  signal?: AbortSignal,
): Promise<PlayerStats> {
  const result = await apiFetch<{ data: PlayerStats }>({
    baseUrl: ctx.baseUrl,
    path: `/players/${address}/stats`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return result.data;
}
