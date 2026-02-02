import type { FetchConfig } from "../types/config.js";
import type { Token, TokenScoreEntry, PaginatedResult, TokensFilterParams } from "../types/token.js";
import { apiFetch, buildQueryString } from "./base.js";

interface ApiContext {
  baseUrl: string;
  fetchConfig?: Partial<FetchConfig>;
}

export async function apiGetTokens(
  ctx: ApiContext,
  params?: TokensFilterParams,
  signal?: AbortSignal,
): Promise<PaginatedResult<Token>> {
  const qs = buildQueryString({
    game_id: params?.game_id,
    owner: params?.owner,
    game_over: params?.game_over,
    limit: params?.limit,
    offset: params?.offset,
  });
  return apiFetch<PaginatedResult<Token>>({
    baseUrl: ctx.baseUrl,
    path: `/tokens${qs}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
}

export async function apiGetToken(
  ctx: ApiContext,
  tokenId: string,
  signal?: AbortSignal,
): Promise<Token> {
  const result = await apiFetch<{ data: Token }>({
    baseUrl: ctx.baseUrl,
    path: `/tokens/${tokenId}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return result.data;
}

export async function apiGetTokenScores(
  ctx: ApiContext,
  tokenId: string,
  limit?: number,
  signal?: AbortSignal,
): Promise<TokenScoreEntry[]> {
  const qs = buildQueryString({ limit });
  const result = await apiFetch<{ data: TokenScoreEntry[] }>({
    baseUrl: ctx.baseUrl,
    path: `/tokens/${tokenId}/scores${qs}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return result.data;
}
