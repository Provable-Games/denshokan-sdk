import type { FetchConfig } from "../types/config.js";
import type { Minter } from "../types/minter.js";
import { apiFetch } from "./base.js";

interface ApiContext {
  baseUrl: string;
  fetchConfig?: Partial<FetchConfig>;
}

export async function apiGetMinters(
  ctx: ApiContext,
  signal?: AbortSignal,
): Promise<Minter[]> {
  const result = await apiFetch<{ data: Minter[] }>({
    baseUrl: ctx.baseUrl,
    path: "/minters",
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return result.data;
}

export async function apiGetMinter(
  ctx: ApiContext,
  minterId: string,
  signal?: AbortSignal,
): Promise<Minter> {
  const result = await apiFetch<{ data: Minter }>({
    baseUrl: ctx.baseUrl,
    path: `/minters/${minterId}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return result.data;
}
