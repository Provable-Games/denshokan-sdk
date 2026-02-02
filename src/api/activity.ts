import type { FetchConfig } from "../types/config.js";
import type { ActivityEvent, ActivityParams, ActivityStats } from "../types/activity.js";
import { apiFetch, buildQueryString } from "./base.js";

interface ApiContext {
  baseUrl: string;
  fetchConfig?: Partial<FetchConfig>;
}

export async function apiGetActivity(
  ctx: ApiContext,
  params?: ActivityParams,
  signal?: AbortSignal,
): Promise<ActivityEvent[]> {
  const qs = buildQueryString({
    type: params?.type,
    limit: params?.limit,
    offset: params?.offset,
  });
  const result = await apiFetch<{ data: ActivityEvent[] }>({
    baseUrl: ctx.baseUrl,
    path: `/activity${qs}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return result.data;
}

export async function apiGetActivityStats(
  ctx: ApiContext,
  gameId?: number,
  signal?: AbortSignal,
): Promise<ActivityStats> {
  const qs = buildQueryString({ game_id: gameId });
  const result = await apiFetch<{ data: ActivityStats }>({
    baseUrl: ctx.baseUrl,
    path: `/activity/stats${qs}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return result.data;
}
