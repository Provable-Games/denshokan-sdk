import type { FetchConfig } from "../types/config.js";
import type {
  Game,
  GameStats,
  LeaderboardEntry,
  LeaderboardPosition,
  LeaderboardParams,
  GameObjective,
  GameObjectiveDetails,
  GameSetting,
  GameSettingDetails,
  DetailsParams,
} from "../types/game.js";
import type { PaginatedResult } from "../types/token.js";
import { apiFetch, buildQueryString } from "./base.js";
import {
  mapGame,
  mapGames,
  mapGameStats,
  mapLeaderboardEntries,
  mapLeaderboardPosition,
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
  params?: { limit?: number; offset?: number },
  signal?: AbortSignal,
): Promise<PaginatedResult<Game>> {
  const qs = buildQueryString({ limit: params?.limit, offset: params?.offset });
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
  gameId: number,
  signal?: AbortSignal,
): Promise<Game> {
  const result = await apiFetch<{ data: Record<string, unknown> }>({
    baseUrl: ctx.baseUrl,
    path: `/games/${gameId}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return mapGame(result.data);
}

export async function apiGetGameStats(
  ctx: ApiContext,
  gameId: number,
  signal?: AbortSignal,
): Promise<GameStats> {
  const result = await apiFetch<{ data: Record<string, unknown> }>({
    baseUrl: ctx.baseUrl,
    path: `/games/${gameId}/stats`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return mapGameStats(result.data);
}

export async function apiGetGameLeaderboard(
  ctx: ApiContext,
  gameId: number,
  params?: LeaderboardParams,
  signal?: AbortSignal,
): Promise<PaginatedResult<LeaderboardEntry>> {
  const qs = buildQueryString({ limit: params?.limit, offset: params?.offset });
  const result = await apiFetch<{ data: Record<string, unknown>[]; total: number }>({
    baseUrl: ctx.baseUrl,
    path: `/games/${gameId}/leaderboard${qs}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return {
    data: mapLeaderboardEntries(result.data),
    total: result.total,
  };
}

export async function apiGetLeaderboardPosition(
  ctx: ApiContext,
  gameId: number,
  tokenId: string,
  context?: number,
  signal?: AbortSignal,
): Promise<LeaderboardPosition> {
  const qs = buildQueryString({ context });
  const result = await apiFetch<{ data: Record<string, unknown> }>({
    baseUrl: ctx.baseUrl,
    path: `/games/${gameId}/leaderboard/position/${tokenId}${qs}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return mapLeaderboardPosition(result.data);
}

export async function apiGetGameObjectives(
  ctx: ApiContext,
  gameId: number,
  signal?: AbortSignal,
): Promise<GameObjective[]> {
  const result = await apiFetch<{ data: GameObjective[] }>({
    baseUrl: ctx.baseUrl,
    path: `/games/${gameId}/objectives`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return result.data;
}

export async function apiGetGameSettings(
  ctx: ApiContext,
  gameId: number,
  signal?: AbortSignal,
): Promise<GameSetting[]> {
  const result = await apiFetch<{ data: GameSetting[] }>({
    baseUrl: ctx.baseUrl,
    path: `/games/${gameId}/settings`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return result.data;
}

// === By game address ===

export async function apiGetObjectivesDetails(
  ctx: ApiContext,
  gameAddress: string,
  params?: DetailsParams,
  signal?: AbortSignal,
): Promise<PaginatedResult<GameObjectiveDetails>> {
  const qs = buildQueryString({ limit: params?.limit, offset: params?.offset });
  const result = await apiFetch<{ data: Record<string, unknown>[]; total: number }>({
    baseUrl: ctx.baseUrl,
    path: `/contracts/${gameAddress}/objectives${qs}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return {
    data: mapObjectivesDetails(result.data),
    total: result.total,
  };
}

export async function apiGetObjectiveDetails(
  ctx: ApiContext,
  gameAddress: string,
  objectiveId: number,
  signal?: AbortSignal,
): Promise<GameObjectiveDetails> {
  const result = await apiFetch<{ data: Record<string, unknown> }>({
    baseUrl: ctx.baseUrl,
    path: `/contracts/${gameAddress}/objectives/${objectiveId}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return mapObjectiveDetails(result.data);
}

export async function apiGetSettingsDetails(
  ctx: ApiContext,
  gameAddress: string,
  params?: DetailsParams,
  signal?: AbortSignal,
): Promise<PaginatedResult<GameSettingDetails>> {
  const qs = buildQueryString({ limit: params?.limit, offset: params?.offset });
  const result = await apiFetch<{ data: Record<string, unknown>[]; total: number }>({
    baseUrl: ctx.baseUrl,
    path: `/contracts/${gameAddress}/settings${qs}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return {
    data: mapSettingsDetails(result.data),
    total: result.total,
  };
}

export async function apiGetSettingDetails(
  ctx: ApiContext,
  gameAddress: string,
  settingsId: number,
  signal?: AbortSignal,
): Promise<GameSettingDetails> {
  const result = await apiFetch<{ data: Record<string, unknown> }>({
    baseUrl: ctx.baseUrl,
    path: `/contracts/${gameAddress}/settings/${settingsId}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return mapSettingDetails(result.data);
}
