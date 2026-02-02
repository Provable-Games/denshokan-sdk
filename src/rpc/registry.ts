import type { Contract } from "starknet";
import type { GameMetadata } from "../types/rpc.js";
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

export async function rpcGameMetadata(
  contract: Contract,
  gameId: number,
): Promise<GameMetadata> {
  return wrapRpcCall(async () => {
    const result = await contract.call("game_metadata", [gameId]);
    const obj = result as Record<string, unknown>;
    return {
      game_id: Number(obj.game_id ?? gameId),
      name: obj.name?.toString() ?? "",
      contract_address: normalizeAddress(obj.contract_address?.toString() ?? "0"),
    };
  }, contract.address);
}

export async function rpcGameAddress(
  contract: Contract,
  gameId: number,
): Promise<string> {
  return wrapRpcCall(async () => {
    const result = await contract.call("game_address", [gameId]);
    return normalizeAddress(result.toString());
  }, contract.address);
}
