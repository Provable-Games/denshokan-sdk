import type { FetchConfig } from "../types/config.js";
import type { Minter } from "../types/minter.js";
import type { PaginatedResult } from "../types/token.js";
import { apiFetch, buildQueryString } from "./base.js";
import { mapMinter, mapMinters } from "../utils/mappers.js";

interface ApiContext {
  baseUrl: string;
  fetchConfig?: Partial<FetchConfig>;
}

interface MintersParams {
  limit?: number;
  offset?: number;
}

export async function apiGetMinters(
  ctx: ApiContext,
  params?: MintersParams,
  signal?: AbortSignal,
): Promise<PaginatedResult<Minter>> {
  const qs = buildQueryString({ limit: params?.limit, offset: params?.offset });
  const result = await apiFetch<{ data: Record<string, unknown>[]; total: number }>({
    baseUrl: ctx.baseUrl,
    path: `/minters${qs}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return {
    data: mapMinters(result.data),
    total: result.total,
  };
}

export async function apiGetMinter(
  ctx: ApiContext,
  minterId: string,
  signal?: AbortSignal,
): Promise<Minter> {
  const result = await apiFetch<{ data: Record<string, unknown> }>({
    baseUrl: ctx.baseUrl,
    path: `/minters/${minterId}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return mapMinter(result.data);
}
