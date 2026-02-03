import type { FetchConfig } from "../types/config.js";
import type { Minter } from "../types/minter.js";
import { apiFetch } from "./base.js";
import { mapMinter, mapMinters } from "../utils/mappers.js";

interface ApiContext {
  baseUrl: string;
  fetchConfig?: Partial<FetchConfig>;
}

export async function apiGetMinters(
  ctx: ApiContext,
  signal?: AbortSignal,
): Promise<Minter[]> {
  const result = await apiFetch<{ data: Record<string, unknown>[] }>({
    baseUrl: ctx.baseUrl,
    path: "/minters",
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return mapMinters(result.data);
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
