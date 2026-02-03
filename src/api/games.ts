import type { FetchConfig } from "../types/config.js";
import type {
  Game,
  GameStats,
  LeaderboardEntry,
  LeaderboardPosition,
  LeaderboardParams,
  GameObjective,
  GameSetting,
} from "../types/game.js";
import { apiFetch, buildQueryString } from "./base.js";
import {
  mapGame,
  mapGames,
  mapGameStats,
  mapLeaderboardEntries,
  mapLeaderboardPosition,
} from "../utils/mappers.js";

interface ApiContext {
  baseUrl: string;
  fetchConfig?: Partial<FetchConfig>;
}

export async function apiGetGames(
  ctx: ApiContext,
  params?: { limit?: number; offset?: number },
  signal?: AbortSignal,
): Promise<Game[]> {
  const qs = buildQueryString({ limit: params?.limit, offset: params?.offset });
  const result = await apiFetch<{ data: Record<string, unknown>[] }>({
    baseUrl: ctx.baseUrl,
    path: `/games${qs}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return mapGames(result.data);
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
): Promise<LeaderboardEntry[]> {
  const qs = buildQueryString({ limit: params?.limit, offset: params?.offset });
  const result = await apiFetch<{ data: Record<string, unknown>[] }>({
    baseUrl: ctx.baseUrl,
    path: `/games/${gameId}/leaderboard${qs}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return mapLeaderboardEntries(result.data);
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
