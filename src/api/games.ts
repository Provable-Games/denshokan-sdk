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
  const result = await apiFetch<{ data: Game[] }>({
    baseUrl: ctx.baseUrl,
    path: `/games${qs}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return result.data;
}

export async function apiGetGame(
  ctx: ApiContext,
  gameId: number,
  signal?: AbortSignal,
): Promise<Game> {
  const result = await apiFetch<{ data: Game }>({
    baseUrl: ctx.baseUrl,
    path: `/games/${gameId}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return result.data;
}

export async function apiGetGameStats(
  ctx: ApiContext,
  gameId: number,
  signal?: AbortSignal,
): Promise<GameStats> {
  const result = await apiFetch<{ data: GameStats }>({
    baseUrl: ctx.baseUrl,
    path: `/games/${gameId}/stats`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return result.data;
}

export async function apiGetGameLeaderboard(
  ctx: ApiContext,
  gameId: number,
  params?: LeaderboardParams,
  signal?: AbortSignal,
): Promise<LeaderboardEntry[]> {
  const qs = buildQueryString({ limit: params?.limit, offset: params?.offset });
  const result = await apiFetch<{ data: LeaderboardEntry[] }>({
    baseUrl: ctx.baseUrl,
    path: `/games/${gameId}/leaderboard${qs}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return result.data;
}

export async function apiGetLeaderboardPosition(
  ctx: ApiContext,
  gameId: number,
  tokenId: string,
  context?: number,
  signal?: AbortSignal,
): Promise<LeaderboardPosition> {
  const qs = buildQueryString({ context });
  const result = await apiFetch<{ data: LeaderboardPosition }>({
    baseUrl: ctx.baseUrl,
    path: `/games/${gameId}/leaderboard/position/${tokenId}${qs}`,
    signal,
    fetchConfig: ctx.fetchConfig,
  });
  return result.data;
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
