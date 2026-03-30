import type { Contract } from "starknet";
import type { FilterResult, TokenFullState, DenshokanTokenState } from "../types/rpc.js";
import type { GameSettingDetails, GameObjectiveDetails } from "../types/game.js";
import type { PaginatedResult } from "../types/token.js";
import { RpcError } from "../errors/index.js";
import { num } from "starknet";
import { toHexTokenId } from "../utils/address.js";

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
  const tokenIds = (obj.token_ids as unknown[])?.map((v) => toHexTokenId(v)) ?? [];
  const total = Number(obj.total ?? 0);
  return { tokenIds, total };
}

function parseTokenFullState(raw: unknown): TokenFullState {
  const obj = raw as Record<string, unknown>;
  const lifecycle = obj.lifecycle as Record<string, unknown>;
  return {
    tokenId: toHexTokenId(obj.token_id),
    owner: num.toHex(obj.owner as bigint),
    playerName: decodeShortString(obj.player_name),
    isPlayable: Boolean(obj.is_playable),
    gameAddress: num.toHex(obj.game_address as bigint),
    gameOver: Boolean(obj.game_over),
    completedObjective: Boolean(obj.completed_objective),
    lifecycle: {
      start: Number(lifecycle.start ?? 0),
      end: Number(lifecycle.end ?? 0),
    },
  };
}

function decodeShortString(value: unknown): string {
  if (!value) return "";
  const hex = num.toHex(value as bigint);
  if (hex === "0x0") return "";
  // Remove 0x prefix and decode hex to string
  const hexStr = hex.slice(2);
  let result = "";
  for (let i = 0; i < hexStr.length; i += 2) {
    const charCode = parseInt(hexStr.slice(i, i + 2), 16);
    if (charCode === 0) break;
    result += String.fromCharCode(charCode);
  }
  return result;
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
// Minter-based filters
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

export async function viewerTokensByMinterAndGame(
  contract: Contract,
  minterAddress: string,
  gameAddress: string,
  offset: number,
  limit: number,
): Promise<FilterResult> {
  return wrapRpcCall(async () => {
    const result = await contract.call("tokens_by_minter_and_game", [
      minterAddress,
      gameAddress,
      offset,
      limit,
    ]);
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

export async function viewerTokensOfOwnerByMinter(
  contract: Contract,
  owner: string,
  minterAddress: string,
  offset: number,
  limit: number,
): Promise<FilterResult> {
  return wrapRpcCall(async () => {
    const result = await contract.call("tokens_of_owner_by_minter", [
      owner,
      minterAddress,
      offset,
      limit,
    ]);
    return parseFilterResult(result);
  }, contract.address);
}

export async function viewerTokensOfOwnerByGameAndSettings(
  contract: Contract,
  owner: string,
  gameAddress: string,
  settingsId: number,
  offset: number,
  limit: number,
): Promise<FilterResult> {
  return wrapRpcCall(async () => {
    const result = await contract.call("tokens_of_owner_by_game_and_settings", [
      owner,
      gameAddress,
      settingsId,
      offset,
      limit,
    ]);
    return parseFilterResult(result);
  }, contract.address);
}

export async function viewerTokensOfOwnerByGameAndObjective(
  contract: Contract,
  owner: string,
  gameAddress: string,
  objectiveId: number,
  offset: number,
  limit: number,
): Promise<FilterResult> {
  return wrapRpcCall(async () => {
    const result = await contract.call("tokens_of_owner_by_game_and_objective", [
      owner,
      gameAddress,
      objectiveId,
      offset,
      limit,
    ]);
    return parseFilterResult(result);
  }, contract.address);
}

export async function viewerTokensOfOwnerByGameAndGameOver(
  contract: Contract,
  owner: string,
  gameAddress: string,
  offset: number,
  limit: number,
): Promise<FilterResult> {
  return wrapRpcCall(async () => {
    const result = await contract.call("tokens_of_owner_by_game_and_game_over", [
      owner,
      gameAddress,
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

export async function viewerTokensByGameAndSoulbound(
  contract: Contract,
  gameAddress: string,
  isSoulbound: boolean,
  offset: number,
  limit: number,
): Promise<FilterResult> {
  return wrapRpcCall(async () => {
    const result = await contract.call("tokens_by_game_and_soulbound", [
      gameAddress,
      isSoulbound,
      offset,
      limit,
    ]);
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

export async function viewerCountTokensByMinterAndGame(
  contract: Contract,
  minterAddress: string,
  gameAddress: string,
): Promise<number> {
  return wrapRpcCall(async () => {
    const result = await contract.call("count_tokens_by_minter_and_game", [
      minterAddress,
      gameAddress,
    ]);
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

export async function viewerCountTokensByGameAndSoulbound(
  contract: Contract,
  gameAddress: string,
  isSoulbound: boolean,
): Promise<number> {
  return wrapRpcCall(async () => {
    const result = await contract.call("count_tokens_by_game_and_soulbound", [
      gameAddress,
      isSoulbound,
    ]);
    return Number(result);
  }, contract.address);
}

export async function viewerCountTokensOfOwnerByMinter(
  contract: Contract,
  owner: string,
  minterAddress: string,
): Promise<number> {
  return wrapRpcCall(async () => {
    const result = await contract.call("count_tokens_of_owner_by_minter", [owner, minterAddress]);
    return Number(result);
  }, contract.address);
}

export async function viewerCountTokensOfOwnerByGameAndSettings(
  contract: Contract,
  owner: string,
  gameAddress: string,
  settingsId: number,
): Promise<number> {
  return wrapRpcCall(async () => {
    const result = await contract.call("count_tokens_of_owner_by_game_and_settings", [
      owner,
      gameAddress,
      settingsId,
    ]);
    return Number(result);
  }, contract.address);
}

export async function viewerCountTokensOfOwnerByGameAndObjective(
  contract: Contract,
  owner: string,
  gameAddress: string,
  objectiveId: number,
): Promise<number> {
  return wrapRpcCall(async () => {
    const result = await contract.call("count_tokens_of_owner_by_game_and_objective", [
      owner,
      gameAddress,
      objectiveId,
    ]);
    return Number(result);
  }, contract.address);
}

export async function viewerCountTokensOfOwnerByGameAndGameOver(
  contract: Contract,
  owner: string,
  gameAddress: string,
): Promise<number> {
  return wrapRpcCall(async () => {
    const result = await contract.call("count_tokens_of_owner_by_game_and_game_over", [
      owner,
      gameAddress,
    ]);
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

// =========================================================================
// Owner tokens (no game filter)
// =========================================================================

export async function viewerTokensOfOwner(
  contract: Contract,
  owner: string,
  offset: number,
  limit: number,
): Promise<FilterResult> {
  return wrapRpcCall(async () => {
    const result = await contract.call("tokens_of_owner", [owner, offset, limit]);
    return parseFilterResult(result);
  }, contract.address);
}

export async function viewerCountTokensOfOwner(
  contract: Contract,
  owner: string,
): Promise<number> {
  return wrapRpcCall(async () => {
    const result = await contract.call("count_tokens_of_owner", [owner]);
    return Number(result);
  }, contract.address);
}

export async function viewerTokensOfOwnerByPlayable(
  contract: Contract,
  owner: string,
  offset: number,
  limit: number,
): Promise<FilterResult> {
  return wrapRpcCall(async () => {
    const result = await contract.call("tokens_of_owner_by_playable", [owner, offset, limit]);
    return parseFilterResult(result);
  }, contract.address);
}

export async function viewerTokensOfOwnerByGameOver(
  contract: Contract,
  owner: string,
  offset: number,
  limit: number,
): Promise<FilterResult> {
  return wrapRpcCall(async () => {
    const result = await contract.call("tokens_of_owner_by_game_over", [owner, offset, limit]);
    return parseFilterResult(result);
  }, contract.address);
}

export async function viewerCountTokensOfOwnerByPlayable(
  contract: Contract,
  owner: string,
): Promise<number> {
  return wrapRpcCall(async () => {
    const result = await contract.call("count_tokens_of_owner_by_playable", [owner]);
    return Number(result);
  }, contract.address);
}

export async function viewerCountTokensOfOwnerByGameOver(
  contract: Contract,
  owner: string,
): Promise<number> {
  return wrapRpcCall(async () => {
    const result = await contract.call("count_tokens_of_owner_by_game_over", [owner]);
    return Number(result);
  }, contract.address);
}

// =========================================================================
// Batch full state
// =========================================================================

export async function viewerTokensFullStateBatch(
  contract: Contract,
  tokenIds: string[],
): Promise<TokenFullState[]> {
  return wrapRpcCall(async () => {
    const result = await contract.call("tokens_full_state_batch", [tokenIds]);
    return (result as unknown[]).map(parseTokenFullState);
  }, contract.address);
}

function parseDenshokanTokenState(raw: unknown): DenshokanTokenState {
  const obj = raw as Record<string, unknown>;
  const base = parseTokenFullState(obj.base);
  return {
    ...base,
    minterAddress: num.toHex(obj.minter_address as bigint),
    rendererAddress: num.toHex(obj.renderer_address as bigint),
    skillsAddress: num.toHex(obj.skills_address as bigint),
    clientUrl: obj.client_url?.toString() ?? "",
  };
}

export async function viewerDenshokanTokensBatch(
  contract: Contract,
  tokenIds: string[],
): Promise<DenshokanTokenState[]> {
  return wrapRpcCall(async () => {
    const result = await contract.call("denshokan_tokens_batch", [tokenIds]);
    return (result as unknown[]).map(parseDenshokanTokenState);
  }, contract.address);
}

// =========================================================================
// Batch token URI
// =========================================================================

// =========================================================================
// Settings & Objectives (via viewer contract)
// =========================================================================

function parseKeyValuePairs(raw: unknown[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const item of raw) {
    const obj = item as Record<string, unknown>;
    const name = obj.name?.toString() ?? "";
    const value = obj.value?.toString() ?? "";
    if (name) result[name] = value;
  }
  return result;
}

function parseSettingsEntry(raw: unknown): GameSettingDetails {
  const entry = raw as Record<string, unknown>;
  const details = entry.details as Record<string, unknown>;
  return {
    id: Number(entry.settings_id ?? 0),
    gameAddress: num.toHex(entry.game_address as bigint),
    creatorAddress: "",
    name: details.name?.toString() ?? "",
    description: details.description?.toString() ?? "",
    settings: parseKeyValuePairs((details.settings as unknown[]) ?? []),
    blockNumber: "",
    createdAt: "",
  };
}

function parseObjectiveEntry(raw: unknown): GameObjectiveDetails {
  const entry = raw as Record<string, unknown>;
  const details = entry.details as Record<string, unknown>;
  return {
    id: Number(entry.objective_id ?? 0),
    gameAddress: num.toHex(entry.game_address as bigint),
    creatorAddress: "",
    name: details.name?.toString() ?? "",
    description: details.description?.toString() ?? "",
    objectives: parseKeyValuePairs((details.objectives as unknown[]) ?? []),
    blockNumber: "",
    createdAt: "",
  };
}

export async function viewerAllSettings(
  contract: Contract,
  gameAddress: string,
  offset: number,
  limit: number,
): Promise<PaginatedResult<GameSettingDetails>> {
  return wrapRpcCall(async () => {
    const result = await contract.call("all_settings", [gameAddress, offset, limit]) as Record<string, unknown>;
    const entries = (result.entries as unknown[]) ?? [];
    const total = Number(result.total ?? 0);
    return {
      data: entries.map(parseSettingsEntry),
      total,
    };
  }, contract.address);
}

export async function viewerAllObjectives(
  contract: Contract,
  gameAddress: string,
  offset: number,
  limit: number,
): Promise<PaginatedResult<GameObjectiveDetails>> {
  return wrapRpcCall(async () => {
    const result = await contract.call("all_objectives", [gameAddress, offset, limit]) as Record<string, unknown>;
    const entries = (result.entries as unknown[]) ?? [];
    const total = Number(result.total ?? 0);
    return {
      data: entries.map(parseObjectiveEntry),
      total,
    };
  }, contract.address);
}

export async function viewerCountSettings(
  contract: Contract,
  gameAddress: string,
): Promise<number> {
  return wrapRpcCall(async () => {
    const result = await contract.call("count_settings", [gameAddress]);
    return Number(result);
  }, contract.address);
}

export async function viewerCountObjectives(
  contract: Contract,
  gameAddress: string,
): Promise<number> {
  return wrapRpcCall(async () => {
    const result = await contract.call("count_objectives", [gameAddress]);
    return Number(result);
  }, contract.address);
}
