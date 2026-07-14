import type { FetchConfig } from "../types/config.js";
import type { Token, TokenScoreEntry, TokenRank, TokenRankParams, TokenRanksResult, TokenSortField, PaginatedResult, TokensQueryParams } from "../types/token.js";
import { apiFetch, buildQueryString } from "./base.js";
import { mapPaginatedTokens, mapToken, mapTokenScoreEntries, mapTokenRank } from "../utils/mappers.js";
import { sortTokensWithTiebreak } from "../utils/sort.js";

/** Map consumer-facing sort field names to the short names the API expects */
export const SORT_FIELD_TO_API: Record<TokenSortField, string> = {
  score: "score",
  mintedAt: "minted",
  lastUpdatedAt: "updated",
  completedAt: "completedAt",
};

interface ApiContext {
  baseUrl: string;
  fetchConfig?: Partial<FetchConfig>;
}

export async function apiGetTokens(
  ctx: ApiContext,
  params?: TokensQueryParams,
  signal?: AbortSignal,
): Promise<PaginatedResult<Token>> {
  // An explicit id set (INCLUDING an empty one) means "filter to exactly these ids".
  // It goes to POST /tokens/query — the id list can be hundreds of felt252 values, too
  // long for a GET query string (mirrors POST /tokens/rank). Branch on presence, not
  // length: an empty array matches NOTHING — never fall through to the unfiltered GET,
  // which would return the global page while a caller's ids are still resolving.
  if (params?.tokenIds !== undefined) {
    if (params.tokenIds.length === 0) return { data: [], total: 0 };

    // The server caps the id list (MAX_TOKENS_BY_IDS = 500). Chunk larger sets into
    // parallel requests, then re-sort + slice the merged result so ordering and
    // limit/offset are uniform regardless of id-set size (the ≤500 branch below lets
    // the server do it). Chunk calls drop limit/offset so each returns its whole set.
    const MAX_IDS_PER_REQUEST = 500;
    if (params.tokenIds.length > MAX_IDS_PER_REQUEST) {
      const chunks: string[][] = [];
      for (let i = 0; i < params.tokenIds.length; i += MAX_IDS_PER_REQUEST) {
        chunks.push(params.tokenIds.slice(i, i + MAX_IDS_PER_REQUEST));
      }
      const pages = await Promise.all(
        chunks.map((ids) =>
          apiGetTokens(
            ctx,
            { ...params, tokenIds: ids, limit: undefined, offset: undefined },
            signal,
          ),
        ),
      );
      const merged = sortTokensWithTiebreak(pages.flatMap((p) => p.data), params.sort);
      const total = merged.length;
      const offset = params.offset ?? 0;
      const data =
        params.limit !== undefined ? merged.slice(offset, offset + params.limit) : merged.slice(offset);
      return { data, total };
    }
    const raw = await apiFetch<{ data: Record<string, unknown>[]; total: number }>({
      baseUrl: ctx.baseUrl,
      path: `/tokens/query`,
      method: "POST",
      body: {
        tokenIds: params.tokenIds,
        gameId: params.gameId,
        owner: params.owner,
        gameOver: params.gameOver,
        minterAddress: params.minterAddress,
        // Context filters, forwarded for parity with the GET path.
        hasContext: params.hasContext,
        contextId: params.contextId,
        contextName: params.contextName,
        sort: params.sort
          ? { field: SORT_FIELD_TO_API[params.sort.field], direction: params.sort.direction }
          : undefined,
        limit: params.limit,
        offset: params.offset,
      },
      signal,
      fetchConfig: ctx.fetchConfig,
    });
    return mapPaginatedTokens(raw);
  }

  const qs = buildQueryString({
    game_id: params?.gameId,
    owner: params?.owner,
    game_over: params?.gameOver,
    has_context: params?.hasContext,
    context_id: params?.contextId,
    context_name: params?.contextName,
    minter_address: params?.minterAddress,
    sort_by: params?.sort?.field ? SORT_FIELD_TO_API[params.sort.field] : undefined,
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

/**
 * Bulk-rank lookup. POST because the tokenIds list can be hundreds of
 * felt252 values — URL-length limits in proxies/CDNs would bite for
 * typical Budokan-scale player profiles.
 *
 * Server caps the list at 500 entries; callers should chunk if exceeding.
 */
export async function apiGetTokenRanks(
  ctx: ApiContext,
  tokenIds: string[],
  params?: TokenRankParams,
  signal?: AbortSignal,
): Promise<TokenRanksResult> {
  const result = await apiFetch<{
    data: Record<string, unknown>[];
    notFound: string[];
  }>({
    baseUrl: ctx.baseUrl,
    path: `/tokens/rank`,
    method: "POST",
    body: {
      tokenIds,
      gameId: params?.gameId,
      settingsId: params?.settingsId,
      objectiveId: params?.objectiveId,
      contextId: params?.contextId,
      contextName: params?.contextName,
      owner: params?.owner,
      minterAddress: params?.minterAddress,
      gameOver: params?.gameOver,
      minScore:
        params?.minScore !== undefined ? params.minScore.toString() : undefined,
      maxScore:
        params?.maxScore !== undefined ? params.maxScore.toString() : undefined,
    },
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return {
    data: result.data.map(mapTokenRank),
    notFound: result.notFound ?? [],
  };
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
