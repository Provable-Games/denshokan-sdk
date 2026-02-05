import type { FetchConfig } from "../types/config.js";
import type { ActivityEvent, ActivityParams, ActivityStats } from "../types/activity.js";
import type { PaginatedResult } from "../types/token.js";
import { apiFetch, buildQueryString } from "./base.js";
import { mapActivityEvents, mapActivityStats } from "../utils/mappers.js";

interface ApiContext {
  baseUrl: string;
  fetchConfig?: Partial<FetchConfig>;
}

export async function apiGetActivity(
  ctx: ApiContext,
  params?: ActivityParams,
  signal?: AbortSignal,
): Promise<PaginatedResult<ActivityEvent>> {
  const qs = buildQueryString({
    type: params?.type,
    limit: params?.limit,
    offset: params?.offset,
  });
  const result = await apiFetch<{ data: Record<string, unknown>[]; total: number }>({
    baseUrl: ctx.baseUrl,
    path: `/activity${qs}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return {
    data: mapActivityEvents(result.data),
    total: result.total,
  };
}

export async function apiGetActivityStats(
  ctx: ApiContext,
  gameId?: number,
  signal?: AbortSignal,
): Promise<ActivityStats> {
  const qs = buildQueryString({ game_id: gameId });
  const result = await apiFetch<{ data: Record<string, unknown> }>({
    baseUrl: ctx.baseUrl,
    path: `/activity/stats${qs}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return mapActivityStats(result.data);
}
