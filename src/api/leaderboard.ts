import type { FetchConfig } from "../types/config.js";
import type { GameCoreLeaderboardEntry, GameCoreLeaderboardParams, PaginatedResult } from "../types/token.js";
import { apiFetch, buildQueryString } from "./base.js";
import { DenshokanError } from "../errors/index.js";

/** API-only: the server must apply the GameCore tiebreak before pagination. */
export async function apiGetGameCoreLeaderboard(
  ctx: { baseUrl: string; fetchConfig?: Partial<FetchConfig> },
  params: GameCoreLeaderboardParams,
  signal?: AbortSignal,
): Promise<PaginatedResult<GameCoreLeaderboardEntry>> {
  const qs = buildQueryString({
    game_address: params.gameAddress,
    minter_address: params.minterAddress,
    context_id: params.contextId,
    sort_order: params.direction ?? "desc",
    limit: params.limit,
    offset: params.offset,
  });
  const result = await apiFetch<PaginatedResult<GameCoreLeaderboardEntry>>({
    ...ctx, baseUrl: ctx.baseUrl, path: `/tokens/leaderboard${qs}`, signal,
  });
  for (const entry of result.data) {
    // Reject numeric scores: their low bits may already have been rounded.
    if (typeof entry.score !== "string" || !/^\d+$/.test(entry.score)
      || BigInt(entry.score) > 0xffffffffffffffffn) {
      throw new DenshokanError("GameCore leaderboard scores must be exact u64 strings");
    }
  }
  return result;
}
