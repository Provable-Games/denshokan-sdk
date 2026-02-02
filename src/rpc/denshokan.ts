import type { Contract } from "starknet";
import type { TokenMetadata } from "../types/token.js";
import type { RoyaltyInfo } from "../types/rpc.js";
import { RpcError } from "../errors/index.js";
import { normalizeAddress } from "../utils/address.js";

function wrapRpcCall<T>(fn: () => Promise<T>, contractAddress?: string): Promise<T> {
  return fn().catch((error: unknown) => {
    throw new RpcError(
      error instanceof Error ? error.message : "RPC call failed",
      contractAddress,
    );
  });
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
    return normalizeAddress(result.toString());
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
      receiver: normalizeAddress(arr[0]?.toString() ?? "0"),
      amount: BigInt(arr[1]?.toString() ?? "0"),
    };
  }, contract.address);
}

// === Batch-first IMinigameToken calls ===

export async function rpcTokenMetadataBatch(
  contract: Contract,
  tokenIds: string[],
): Promise<TokenMetadata[]> {
  return wrapRpcCall(async () => {
    const result = await contract.call("token_metadata_batch", [tokenIds]);
    return (result as unknown as unknown[]).map(parseTokenMetadata);
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
    return (result as unknown as unknown[]).map((v) => v?.toString() ?? "");
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
    return (result as unknown as unknown[]).map((v) => normalizeAddress(v?.toString() ?? "0"));
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
    return (result as unknown as unknown[]).map((v) => normalizeAddress(v?.toString() ?? "0"));
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
    return (result as unknown as unknown[]).map((v) => normalizeAddress(v?.toString() ?? "0"));
  }, contract.address);
}

export async function rpcTokenGameAddress(contract: Contract, tokenId: string): Promise<string> {
  const [result] = await rpcTokenGameAddressBatch(contract, [tokenId]);
  return result;
}

// === Write operations ===

export async function rpcMintBatch(
  contract: Contract,
  mints: Array<{
    game_id: number;
    settings_id: number;
    objective_id: number;
    player_name: string;
    soulbound: boolean;
    to: string;
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
    soulbound: boolean;
    to: string;
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

function parseTokenMetadata(raw: unknown): TokenMetadata {
  const obj = raw as Record<string, unknown>;
  return {
    game_id: Number(obj.game_id ?? 0),
    settings_id: Number(obj.settings_id ?? 0),
    objective_id: Number(obj.objective_id ?? 0),
    player_name: obj.player_name?.toString() ?? "",
    minted_by: normalizeAddress(obj.minted_by?.toString() ?? "0"),
    is_playable: Boolean(obj.is_playable),
    is_soulbound: Boolean(obj.is_soulbound),
    renderer_address: normalizeAddress(obj.renderer_address?.toString() ?? "0"),
    game_address: normalizeAddress(obj.game_address?.toString() ?? "0"),
  };
}
