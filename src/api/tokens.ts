import type { FetchConfig } from "../types/config.js";
import type { Token, TokenScoreEntry, TokenRank, TokenRankParams, PaginatedResult, TokensQueryParams } from "../types/token.js";
import { apiFetch, buildQueryString } from "./base.js";
import { mapPaginatedTokens, mapToken, mapTokenScoreEntries, mapTokenRank } from "../utils/mappers.js";

interface ApiContext {
  baseUrl: string;
  fetchConfig?: Partial<FetchConfig>;
}

export async function apiGetTokens(
  ctx: ApiContext,
  params?: TokensQueryParams,
  signal?: AbortSignal,
): Promise<PaginatedResult<Token>> {
  const qs = buildQueryString({
    game_id: params?.gameId,
    owner: params?.owner,
    game_over: params?.gameOver,
    has_context: params?.hasContext,
    context_id: params?.contextId,
    context_name: params?.contextName,
    minter_address: params?.minterAddress,
    sort_by: params?.sort?.field,
    sort_order: params?.sort?.direction,
    limit: params?.limit,
    offset: params?.offset,
  });
  const raw = await apiFetch<{ data: Record<string, unknown>[]; total: number }>({
    baseUrl: ctx.baseUrl,
    path: `/tokens${qs}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return mapPaginatedTokens(raw);
}

export async function apiGetToken(
  ctx: ApiContext,
  tokenId: string,
  signal?: AbortSignal,
): Promise<Token> {
  const result = await apiFetch<{ data: Record<string, unknown> }>({
    baseUrl: ctx.baseUrl,
    path: `/tokens/${tokenId}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return mapToken(result.data);
}

export async function apiGetTokenRank(
  ctx: ApiContext,
  tokenId: string,
  params?: TokenRankParams,
  signal?: AbortSignal,
): Promise<TokenRank> {
  const qs = buildQueryString({
    game_id: params?.gameId,
    settings_id: params?.settingsId,
    objective_id: params?.objectiveId,
    context_id: params?.contextId,
    context_name: params?.contextName,
    owner: params?.owner,
    minter_address: params?.minterAddress,
    game_over: params?.gameOver,
    min_score: params?.minScore !== undefined ? params.minScore.toString() : undefined,
    max_score: params?.maxScore !== undefined ? params.maxScore.toString() : undefined,
  });
  const result = await apiFetch<{ data: Record<string, unknown> }>({
    baseUrl: ctx.baseUrl,
    path: `/tokens/${tokenId}/rank${qs}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return mapTokenRank(result.data);
}

export async function apiGetTokenScores(
  ctx: ApiContext,
  tokenId: string,
  limit?: number,
  signal?: AbortSignal,
): Promise<TokenScoreEntry[]> {
  const qs = buildQueryString({ limit });
  const result = await apiFetch<{ data: Record<string, unknown>[] }>({
    baseUrl: ctx.baseUrl,
    path: `/tokens/${tokenId}/scores${qs}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return mapTokenScoreEntries(result.data);
}
