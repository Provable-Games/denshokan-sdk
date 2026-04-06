import type { Contract } from "starknet";
import type { TokenMetadata, TokenMutableState } from "../types/token.js";
import type { RoyaltyInfo, FilterResult } from "../types/rpc.js";
import { RpcError } from "../errors/index.js";
import { toHexTokenId } from "../utils/address.js";

let starknetModule: typeof import("starknet") | null = null;

async function getStarknet(): Promise<typeof import("starknet")> {
  if (!starknetModule) {
    starknetModule = await import("starknet");
  }
  return starknetModule;
}

function wrapRpcCall<T>(fn: () => Promise<T>, contractAddress?: string): Promise<T> {
  return fn().catch((error: unknown) => {
    throw new RpcError(
      error instanceof Error ? error.message : "RPC call failed",
      contractAddress,
    );
  });
}

/**
 * Convert a BigInt or hex/decimal string to a normalized 0x-prefixed hex address.
 */
function toHexAddress(value: unknown): string {
  if (typeof value === "bigint") {
    return "0x" + value.toString(16).padStart(64, "0");
  }
  const str = String(value);
  // If already hex, normalize it
  if (str.startsWith("0x")) {
    const stripped = str.slice(2).replace(/^0+/, "");
    return "0x" + stripped.padStart(64, "0");
  }
  // Decimal string - convert to hex
  try {
    const bigVal = BigInt(str);
    return "0x" + bigVal.toString(16).padStart(64, "0");
  } catch {
    return "0x" + "0".repeat(64);
  }
}

/**
 * Decode a felt252 (BigInt or hex string) to an ASCII string.
 */
async function feltToString(value: unknown): Promise<string> {
  if (value === null || value === undefined || value === 0n || value === "0" || value === "0x0") {
    return "";
  }
  const starknet = await getStarknet();
  try {
    // Convert to hex string for decodeShortString
    let hexStr: string;
    if (typeof value === "bigint") {
      hexStr = "0x" + value.toString(16);
    } else {
      const str = String(value);
      if (str.startsWith("0x")) {
        hexStr = str;
      } else {
        hexStr = "0x" + BigInt(str).toString(16);
      }
    }
    return starknet.shortString.decodeShortString(hexStr);
  } catch {
    return String(value);
  }
}

// === ERC721 standard calls (non-batchable) ===

export async function rpcBalanceOf(contract: Contract, account: string): Promise<bigint> {
  return wrapRpcCall(async () => {
    const result = await contract.call("balance_of", [account]);
    return BigInt(result.toString());
  }, contract.address);
}

export async function rpcOwnerOf(contract: Contract, tokenId: string): Promise<string> {
  return wrapRpcCall(async () => {
    const result = await contract.call("owner_of", [tokenId]);
    return toHexAddress(result);
  }, contract.address);
}

export async function rpcTokenUri(contract: Contract, tokenId: string): Promise<string> {
  return wrapRpcCall(async () => {
    const result = await contract.call("token_uri", [tokenId]);
    return result.toString();
  }, contract.address);
}

export async function rpcName(contract: Contract): Promise<string> {
  return wrapRpcCall(async () => {
    const result = await contract.call("name");
    return result.toString();
  }, contract.address);
}

export async function rpcSymbol(contract: Contract): Promise<string> {
  return wrapRpcCall(async () => {
    const result = await contract.call("symbol");
    return result.toString();
  }, contract.address);
}

export async function rpcRoyaltyInfo(
  contract: Contract,
  tokenId: string,
  salePrice: bigint,
): Promise<RoyaltyInfo> {
  return wrapRpcCall(async () => {
    const result = await contract.call("royalty_info", [tokenId, salePrice]);
    const arr = result as unknown as [unknown, unknown];
    return {
      receiver: toHexAddress(arr[0] ?? 0),
      amount: BigInt(String(arr[1] ?? 0)),
    };
  }, contract.address);
}

// === ERC721Enumerable (owner-based) ===

export async function rpcTokenOfOwnerByIndex(
  contract: Contract,
  owner: string,
  index: bigint,
): Promise<string> {
  return wrapRpcCall(async () => {
    const result = await contract.call("token_of_owner_by_index", [owner, index]);
    return toHexTokenId(result);
  }, contract.address);
}

// === Batch-first IMinigameToken calls ===

export async function rpcTokenMetadataBatch(
  contract: Contract,
  tokenIds: string[],
): Promise<TokenMetadata[]> {
  return wrapRpcCall(async () => {
    const result = await contract.call("token_metadata_batch", [tokenIds]);
    const values = result as unknown as unknown[];
    return Promise.all(values.map(parseTokenMetadata));
  }, contract.address);
}

export async function rpcTokenMetadata(
  contract: Contract,
  tokenId: string,
): Promise<TokenMetadata> {
  const [result] = await rpcTokenMetadataBatch(contract, [tokenId]);
  return result;
}

export async function rpcIsPlayableBatch(
  contract: Contract,
  tokenIds: string[],
): Promise<boolean[]> {
  return wrapRpcCall(async () => {
    const result = await contract.call("is_playable_batch", [tokenIds]);
    return (result as unknown as unknown[]).map((v) => Boolean(v));
  }, contract.address);
}

export async function rpcIsPlayable(contract: Contract, tokenId: string): Promise<boolean> {
  const [result] = await rpcIsPlayableBatch(contract, [tokenId]);
  return result;
}

export async function rpcSettingsIdBatch(
  contract: Contract,
  tokenIds: string[],
): Promise<number[]> {
  return wrapRpcCall(async () => {
    const result = await contract.call("settings_id_batch", [tokenIds]);
    return (result as unknown as unknown[]).map((v) => Number(v));
  }, contract.address);
}

export async function rpcSettingsId(contract: Contract, tokenId: string): Promise<number> {
  const [result] = await rpcSettingsIdBatch(contract, [tokenId]);
  return result;
}

export async function rpcPlayerNameBatch(
  contract: Contract,
  tokenIds: string[],
): Promise<string[]> {
  return wrapRpcCall(async () => {
    const result = await contract.call("player_name_batch", [tokenIds]);
    const values = result as unknown as unknown[];
    return Promise.all(values.map((v) => feltToString(v)));
  }, contract.address);
}

export async function rpcPlayerName(contract: Contract, tokenId: string): Promise<string> {
  const [result] = await rpcPlayerNameBatch(contract, [tokenId]);
  return result;
}

export async function rpcObjectiveIdBatch(
  contract: Contract,
  tokenIds: string[],
): Promise<number[]> {
  return wrapRpcCall(async () => {
    const result = await contract.call("objective_id_batch", [tokenIds]);
    return (result as unknown as unknown[]).map((v) => Number(v));
  }, contract.address);
}

export async function rpcObjectiveId(contract: Contract, tokenId: string): Promise<number> {
  const [result] = await rpcObjectiveIdBatch(contract, [tokenId]);
  return result;
}

export async function rpcMintedByBatch(
  contract: Contract,
  tokenIds: string[],
): Promise<string[]> {
  return wrapRpcCall(async () => {
    const result = await contract.call("minted_by_batch", [tokenIds]);
    return (result as unknown as unknown[]).map((v) => toHexAddress(v ?? 0));
  }, contract.address);
}

export async function rpcMintedBy(contract: Contract, tokenId: string): Promise<string> {
  const [result] = await rpcMintedByBatch(contract, [tokenId]);
  return result;
}

export async function rpcIsSoulboundBatch(
  contract: Contract,
  tokenIds: string[],
): Promise<boolean[]> {
  return wrapRpcCall(async () => {
    const result = await contract.call("is_soulbound_batch", [tokenIds]);
    return (result as unknown as unknown[]).map((v) => Boolean(v));
  }, contract.address);
}

export async function rpcIsSoulbound(contract: Contract, tokenId: string): Promise<boolean> {
  const [result] = await rpcIsSoulboundBatch(contract, [tokenId]);
  return result;
}

export async function rpcRendererAddressBatch(
  contract: Contract,
  tokenIds: string[],
): Promise<string[]> {
  return wrapRpcCall(async () => {
    const result = await contract.call("renderer_address_batch", [tokenIds]);
    return (result as unknown as unknown[]).map((v) => toHexAddress(v ?? 0));
  }, contract.address);
}

export async function rpcRendererAddress(contract: Contract, tokenId: string): Promise<string> {
  const [result] = await rpcRendererAddressBatch(contract, [tokenId]);
  return result;
}

export async function rpcTokenGameAddressBatch(
  contract: Contract,
  tokenIds: string[],
): Promise<string[]> {
  return wrapRpcCall(async () => {
    const result = await contract.call("token_game_address_batch", [tokenIds]);
    return (result as unknown as unknown[]).map((v) => toHexAddress(v ?? 0));
  }, contract.address);
}

export async function rpcTokenGameAddress(contract: Contract, tokenId: string): Promise<string> {
  const [result] = await rpcTokenGameAddressBatch(contract, [tokenId]);
  return result;
}

export async function rpcTokenMutableStateBatch(
  contract: Contract,
  tokenIds: string[],
): Promise<TokenMutableState[]> {
  return wrapRpcCall(async () => {
    const result = await contract.call("token_mutable_state_batch", [tokenIds]);
    return (result as unknown as unknown[]).map(parseTokenMutableState);
  }, contract.address);
}

export async function rpcTokenMutableState(
  contract: Contract,
  tokenId: string,
): Promise<TokenMutableState> {
  const [result] = await rpcTokenMutableStateBatch(contract, [tokenId]);
  return result;
}

// === Filter queries (IDenshokanFilter) ===

function parseFilterResult(raw: unknown): FilterResult {
  const obj = raw as Record<string, unknown>;
  const tokenIds = (obj.token_ids as unknown[])?.map((v) => String(v)) ?? [];
  const total = Number(obj.total ?? 0);
  return { tokenIds, total };
}

// Game-based filters

export async function rpcTokensByGameAddress(
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

export async function rpcTokensByGameAndSettings(
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

export async function rpcTokensByGameAndObjective(
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

// Minter-based filter

export async function rpcTokensByMinterAddress(
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

// Owner + Game filter

export async function rpcTokensOfOwnerByGame(
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

// Soulbound filter

export async function rpcTokensBySoulbound(
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

// Time-based filter

export async function rpcTokensByMintedAtRange(
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

// Count functions

export async function rpcCountTokensByGameAddress(
  contract: Contract,
  gameAddress: string,
): Promise<number> {
  return wrapRpcCall(async () => {
    const result = await contract.call("count_tokens_by_game_address", [gameAddress]);
    return Number(result);
  }, contract.address);
}

export async function rpcCountTokensByGameAndSettings(
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

export async function rpcCountTokensByGameAndObjective(
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

export async function rpcCountTokensByMinterAddress(
  contract: Contract,
  minterAddress: string,
): Promise<number> {
  return wrapRpcCall(async () => {
    const result = await contract.call("count_tokens_by_minter_address", [minterAddress]);
    return Number(result);
  }, contract.address);
}

export async function rpcCountTokensOfOwnerByGame(
  contract: Contract,
  owner: string,
  gameAddress: string,
): Promise<number> {
  return wrapRpcCall(async () => {
    const result = await contract.call("count_tokens_of_owner_by_game", [owner, gameAddress]);
    return Number(result);
  }, contract.address);
}

export async function rpcCountTokensBySoulbound(
  contract: Contract,
  isSoulbound: boolean,
): Promise<number> {
  return wrapRpcCall(async () => {
    const result = await contract.call("count_tokens_by_soulbound", [isSoulbound]);
    return Number(result);
  }, contract.address);
}

export async function rpcCountTokensByMintedAtRange(
  contract: Contract,
  startTime: number,
  endTime: number,
): Promise<number> {
  return wrapRpcCall(async () => {
    const result = await contract.call("count_tokens_by_minted_at_range", [startTime, endTime]);
    return Number(result);
  }, contract.address);
}

// === Write operations ===

export async function rpcMintBatch(
  contract: Contract,
  mints: Array<{
    game_id: number;
    settings_id: number;
    objective_id: number;
    player_name: string;
    skills_address: string;
    soulbound: boolean;
    to: string;
    salt: number;
    metadata: number;
  }>,
): Promise<string[]> {
  return wrapRpcCall(async () => {
    const result = await contract.invoke("mint_batch", [mints]);
    return (result as unknown as unknown[]).map((v) => v?.toString() ?? "");
  }, contract.address);
}

export async function rpcMint(
  contract: Contract,
  params: {
    game_id: number;
    settings_id: number;
    objective_id: number;
    player_name: string;
    skills_address: string;
    soulbound: boolean;
    to: string;
    salt: number;
    metadata: number;
  },
): Promise<string> {
  const [result] = await rpcMintBatch(contract, [params]);
  return result;
}

export async function rpcUpdateGameBatch(
  contract: Contract,
  tokenIds: string[],
): Promise<void> {
  return wrapRpcCall(async () => {
    await contract.invoke("update_game_batch", [tokenIds]);
  }, contract.address);
}

export async function rpcUpdateGame(contract: Contract, tokenId: string): Promise<void> {
  return rpcUpdateGameBatch(contract, [tokenId]);
}

export async function rpcUpdatePlayerNameBatch(
  contract: Contract,
  updates: Array<{ token_id: string; name: string }>,
): Promise<void> {
  return wrapRpcCall(async () => {
    await contract.invoke("update_player_name_batch", [updates]);
  }, contract.address);
}

export async function rpcUpdatePlayerName(
  contract: Contract,
  tokenId: string,
  name: string,
): Promise<void> {
  return rpcUpdatePlayerNameBatch(contract, [{ token_id: tokenId, name }]);
}

// === Helpers ===

async function parseTokenMetadata(raw: unknown): Promise<TokenMetadata> {
  const obj = raw as Record<string, unknown>;
  const playerName = await feltToString(obj.player_name);
  return {
    gameId: Number(obj.game_id ?? 0),
    settingsId: Number(obj.settings_id ?? 0),
    objectiveId: Number(obj.objective_id ?? 0),
    playerName,
    mintedBy: toHexAddress(obj.minted_by ?? 0),
    isPlayable: Boolean(obj.is_playable),
    isSoulbound: Boolean(obj.is_soulbound),
    rendererAddress: toHexAddress(obj.renderer_address ?? 0),
    gameAddress: toHexAddress(obj.game_address ?? 0),
  };
}

function parseTokenMutableState(raw: unknown): TokenMutableState {
  const obj = raw as Record<string, unknown>;
  return {
    gameOver: Boolean(obj.game_over),
    completedObjective: Boolean(obj.completed_objective),
  };
}
