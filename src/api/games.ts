import type { FetchConfig } from "../types/config.js";
import type {
  Game,
  GameObjectiveDetails,
  GameSettingDetails,
  SettingsParams,
  ObjectivesParams,
} from "../types/game.js";
import type { PaginatedResult } from "../types/token.js";
import { apiFetch, buildQueryString } from "./base.js";
import {
  mapGame,
  mapGames,
  mapObjectiveDetails,
  mapObjectivesDetails,
  mapSettingDetails,
  mapSettingsDetails,
} from "../utils/mappers.js";

interface ApiContext {
  baseUrl: string;
  fetchConfig?: Partial<FetchConfig>;
}

export async function apiGetGames(
  ctx: ApiContext,
  params?: { sort?: { field: string; direction: "asc" | "desc" }; limit?: number; offset?: number; genre?: string; developer?: string; publisher?: string },
  signal?: AbortSignal,
): Promise<PaginatedResult<Game>> {
  const qs = buildQueryString({ sort_by: params?.sort?.field, sort_order: params?.sort?.direction, limit: params?.limit, offset: params?.offset, genre: params?.genre, developer: params?.developer, publisher: params?.publisher });
  const result = await apiFetch<{ data: Record<string, unknown>[]; total: number }>({
    baseUrl: ctx.baseUrl,
    path: `/games${qs}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return {
    data: mapGames(result.data),
    total: result.total,
  };
}

export async function apiGetGame(
  ctx: ApiContext,
  gameAddress: string,
  signal?: AbortSignal,
): Promise<Game> {
  const result = await apiFetch<{ data: Record<string, unknown> }>({
    baseUrl: ctx.baseUrl,
    path: `/games/${gameAddress}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return mapGame(result.data);
}

// === Settings (unified - supports both global and per-game) ===

export async function apiGetSettings(
  ctx: ApiContext,
  params?: SettingsParams,
  signal?: AbortSignal,
): Promise<PaginatedResult<GameSettingDetails>> {
  if (params?.gameAddress) {
    // Per-game settings via /games/:address/settings
    const qs = buildQueryString({ sort_by: params?.sort?.field, sort_order: params?.sort?.direction, limit: params?.limit, offset: params?.offset });
    const result = await apiFetch<{ data: Record<string, unknown>[]; total?: number }>({
      baseUrl: ctx.baseUrl,
      path: `/games/${params.gameAddress}/settings${qs}`,
      signal,
      fetchConfig: ctx.fetchConfig,
    });
    const data = mapSettingsDetails(result.data);
    return { data, total: result.total ?? data.length };
  }
  // Global settings via /settings
  const qs = buildQueryString({
    sort_by: params?.sort?.field,
    sort_order: params?.sort?.direction,
    limit: params?.limit,
    offset: params?.offset,
  });
  const result = await apiFetch<{ data: Record<string, unknown>[]; total: number }>({
    baseUrl: ctx.baseUrl,
    path: `/settings${qs}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return {
    data: mapSettingsDetails(result.data),
    total: result.total,
  };
}

export async function apiGetSetting(
  ctx: ApiContext,
  gameAddress: string,
  settingsId: number,
  signal?: AbortSignal,
): Promise<GameSettingDetails> {
  const result = await apiFetch<{ data: Record<string, unknown> }>({
    baseUrl: ctx.baseUrl,
    path: `/games/${gameAddress}/settings/${settingsId}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return mapSettingDetails(result.data);
}

// === Objectives (unified - supports both global and per-game) ===

export async function apiGetObjectives(
  ctx: ApiContext,
  params?: ObjectivesParams,
  signal?: AbortSignal,
): Promise<PaginatedResult<GameObjectiveDetails>> {
  if (params?.gameAddress) {
    // Per-game objectives via /games/:address/objectives
    const qs = buildQueryString({
      sort_by: params?.sort?.field,
      sort_order: params?.sort?.direction,
      limit: params?.limit,
      offset: params?.offset,
    });
    const result = await apiFetch<{ data: Record<string, unknown>[]; total?: number }>({
      baseUrl: ctx.baseUrl,
      path: `/games/${params.gameAddress}/objectives${qs}`,
      signal,
      fetchConfig: ctx.fetchConfig,
    });
    const data = mapObjectivesDetails(result.data);
    return { data, total: result.total ?? data.length };
  }
  // Global objectives via /objectives
  const qs = buildQueryString({
    sort_by: params?.sort?.field,
    sort_order: params?.sort?.direction,
    limit: params?.limit,
    offset: params?.offset,
  });
  const result = await apiFetch<{ data: Record<string, unknown>[]; total: number }>({
    baseUrl: ctx.baseUrl,
    path: `/objectives${qs}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return {
    data: mapObjectivesDetails(result.data),
    total: result.total,
  };
}

export async function apiGetObjective(
  ctx: ApiContext,
  gameAddress: string,
  objectiveId: number,
  signal?: AbortSignal,
): Promise<GameObjectiveDetails> {
  const result = await apiFetch<{ data: Record<string, unknown> }>({
    baseUrl: ctx.baseUrl,
    path: `/games/${gameAddress}/objectives/${objectiveId}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return mapObjectiveDetails(result.data);
}
