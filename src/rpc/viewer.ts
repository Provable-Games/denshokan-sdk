import type { Contract } from "starknet";
import type { FilterResult } from "../types/rpc.js";
import { RpcError } from "../errors/index.js";

function wrapRpcCall<T>(fn: () => Promise<T>, contractAddress?: string): Promise<T> {
  return fn().catch((error: unknown) => {
    throw new RpcError(
      error instanceof Error ? error.message : "RPC call failed",
      contractAddress,
    );
  });
}

function parseFilterResult(raw: unknown): FilterResult {
  const obj = raw as Record<string, unknown>;
  const tokenIds = (obj.token_ids as unknown[])?.map((v) => String(v)) ?? [];
  const total = Number(obj.total ?? 0);
  return { tokenIds, total };
}

// =========================================================================
// Game-based filters
// =========================================================================

export async function viewerTokensByGameAddress(
  contract: Contract,
  gameAddress: string,
  offset: number,
  limit: number,
): Promise<FilterResult> {
  return wrapRpcCall(async () => {
    const result = await contract.call("tokens_by_game_address", [gameAddress, offset, limit]);
    return parseFilterResult(result);
  }, contract.address);
}

export async function viewerTokensByGameAndSettings(
  contract: Contract,
  gameAddress: string,
  settingsId: number,
  offset: number,
  limit: number,
): Promise<FilterResult> {
  return wrapRpcCall(async () => {
    const result = await contract.call("tokens_by_game_and_settings", [
      gameAddress,
      settingsId,
      offset,
      limit,
    ]);
    return parseFilterResult(result);
  }, contract.address);
}

export async function viewerTokensByGameAndObjective(
  contract: Contract,
  gameAddress: string,
  objectiveId: number,
  offset: number,
  limit: number,
): Promise<FilterResult> {
  return wrapRpcCall(async () => {
    const result = await contract.call("tokens_by_game_and_objective", [
      gameAddress,
      objectiveId,
      offset,
      limit,
    ]);
    return parseFilterResult(result);
  }, contract.address);
}

export async function viewerTokensByGameAndPlayable(
  contract: Contract,
  gameAddress: string,
  offset: number,
  limit: number,
): Promise<FilterResult> {
  return wrapRpcCall(async () => {
    const result = await contract.call("tokens_by_game_and_playable", [
      gameAddress,
      offset,
      limit,
    ]);
    return parseFilterResult(result);
  }, contract.address);
}

export async function viewerTokensByGameAndGameOver(
  contract: Contract,
  gameAddress: string,
  offset: number,
  limit: number,
): Promise<FilterResult> {
  return wrapRpcCall(async () => {
    const result = await contract.call("tokens_by_game_and_game_over", [
      gameAddress,
      offset,
      limit,
    ]);
    return parseFilterResult(result);
  }, contract.address);
}

// =========================================================================
// Minter-based filter
// =========================================================================

export async function viewerTokensByMinterAddress(
  contract: Contract,
  minterAddress: string,
  offset: number,
  limit: number,
): Promise<FilterResult> {
  return wrapRpcCall(async () => {
    const result = await contract.call("tokens_by_minter_address", [minterAddress, offset, limit]);
    return parseFilterResult(result);
  }, contract.address);
}

// =========================================================================
// Owner-based filters
// =========================================================================

export async function viewerTokensOfOwnerByGame(
  contract: Contract,
  owner: string,
  gameAddress: string,
  offset: number,
  limit: number,
): Promise<FilterResult> {
  return wrapRpcCall(async () => {
    const result = await contract.call("tokens_of_owner_by_game", [
      owner,
      gameAddress,
      offset,
      limit,
    ]);
    return parseFilterResult(result);
  }, contract.address);
}

export async function viewerTokensOfOwnerByGameAndPlayable(
  contract: Contract,
  owner: string,
  gameAddress: string,
  offset: number,
  limit: number,
): Promise<FilterResult> {
  return wrapRpcCall(async () => {
    const result = await contract.call("tokens_of_owner_by_game_and_playable", [
      owner,
      gameAddress,
      offset,
      limit,
    ]);
    return parseFilterResult(result);
  }, contract.address);
}

export async function viewerTokensOfOwnerBySoulbound(
  contract: Contract,
  owner: string,
  isSoulbound: boolean,
  offset: number,
  limit: number,
): Promise<FilterResult> {
  return wrapRpcCall(async () => {
    const result = await contract.call("tokens_of_owner_by_soulbound", [
      owner,
      isSoulbound,
      offset,
      limit,
    ]);
    return parseFilterResult(result);
  }, contract.address);
}

// =========================================================================
// Soulbound filter
// =========================================================================

export async function viewerTokensBySoulbound(
  contract: Contract,
  isSoulbound: boolean,
  offset: number,
  limit: number,
): Promise<FilterResult> {
  return wrapRpcCall(async () => {
    const result = await contract.call("tokens_by_soulbound", [isSoulbound, offset, limit]);
    return parseFilterResult(result);
  }, contract.address);
}

// =========================================================================
// Time-based filter
// =========================================================================

export async function viewerTokensByMintedAtRange(
  contract: Contract,
  startTime: number,
  endTime: number,
  offset: number,
  limit: number,
): Promise<FilterResult> {
  return wrapRpcCall(async () => {
    const result = await contract.call("tokens_by_minted_at_range", [
      startTime,
      endTime,
      offset,
      limit,
    ]);
    return parseFilterResult(result);
  }, contract.address);
}

// =========================================================================
// Playable filter (global)
// =========================================================================

export async function viewerTokensByPlayable(
  contract: Contract,
  offset: number,
  limit: number,
): Promise<FilterResult> {
  return wrapRpcCall(async () => {
    const result = await contract.call("tokens_by_playable", [offset, limit]);
    return parseFilterResult(result);
  }, contract.address);
}

// =========================================================================
// Count functions
// =========================================================================

export async function viewerCountTokensByGameAddress(
  contract: Contract,
  gameAddress: string,
): Promise<number> {
  return wrapRpcCall(async () => {
    const result = await contract.call("count_tokens_by_game_address", [gameAddress]);
    return Number(result);
  }, contract.address);
}

export async function viewerCountTokensByGameAndSettings(
  contract: Contract,
  gameAddress: string,
  settingsId: number,
): Promise<number> {
  return wrapRpcCall(async () => {
    const result = await contract.call("count_tokens_by_game_and_settings", [
      gameAddress,
      settingsId,
    ]);
    return Number(result);
  }, contract.address);
}

export async function viewerCountTokensByGameAndObjective(
  contract: Contract,
  gameAddress: string,
  objectiveId: number,
): Promise<number> {
  return wrapRpcCall(async () => {
    const result = await contract.call("count_tokens_by_game_and_objective", [
      gameAddress,
      objectiveId,
    ]);
    return Number(result);
  }, contract.address);
}

export async function viewerCountTokensByMinterAddress(
  contract: Contract,
  minterAddress: string,
): Promise<number> {
  return wrapRpcCall(async () => {
    const result = await contract.call("count_tokens_by_minter_address", [minterAddress]);
    return Number(result);
  }, contract.address);
}

export async function viewerCountTokensOfOwnerByGame(
  contract: Contract,
  owner: string,
  gameAddress: string,
): Promise<number> {
  return wrapRpcCall(async () => {
    const result = await contract.call("count_tokens_of_owner_by_game", [owner, gameAddress]);
    return Number(result);
  }, contract.address);
}

export async function viewerCountTokensBySoulbound(
  contract: Contract,
  isSoulbound: boolean,
): Promise<number> {
  return wrapRpcCall(async () => {
    const result = await contract.call("count_tokens_by_soulbound", [isSoulbound]);
    return Number(result);
  }, contract.address);
}

export async function viewerCountTokensByMintedAtRange(
  contract: Contract,
  startTime: number,
  endTime: number,
): Promise<number> {
  return wrapRpcCall(async () => {
    const result = await contract.call("count_tokens_by_minted_at_range", [startTime, endTime]);
    return Number(result);
  }, contract.address);
}

export async function viewerCountTokensByGameAndPlayable(
  contract: Contract,
  gameAddress: string,
): Promise<number> {
  return wrapRpcCall(async () => {
    const result = await contract.call("count_tokens_by_game_and_playable", [gameAddress]);
    return Number(result);
  }, contract.address);
}

export async function viewerCountTokensByGameAndGameOver(
  contract: Contract,
  gameAddress: string,
): Promise<number> {
  return wrapRpcCall(async () => {
    const result = await contract.call("count_tokens_by_game_and_game_over", [gameAddress]);
    return Number(result);
  }, contract.address);
}

export async function viewerCountTokensOfOwnerByGameAndPlayable(
  contract: Contract,
  owner: string,
  gameAddress: string,
): Promise<number> {
  return wrapRpcCall(async () => {
    const result = await contract.call("count_tokens_of_owner_by_game_and_playable", [
      owner,
      gameAddress,
    ]);
    return Number(result);
  }, contract.address);
}

export async function viewerCountTokensByPlayable(contract: Contract): Promise<number> {
  return wrapRpcCall(async () => {
    const result = await contract.call("count_tokens_by_playable", []);
    return Number(result);
  }, contract.address);
}

export async function viewerCountTokensOfOwnerBySoulbound(
  contract: Contract,
  owner: string,
  isSoulbound: boolean,
): Promise<number> {
  return wrapRpcCall(async () => {
    const result = await contract.call("count_tokens_of_owner_by_soulbound", [owner, isSoulbound]);
    return Number(result);
  }, contract.address);
}
