import type { Contract } from "starknet";
import type { GameMetadata } from "../types/rpc.js";
import { RpcError } from "../errors/index.js";
import { toHexAddress } from "../utils/address.js";

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
      gameId,
      contractAddress: toHexAddress(obj.contract_address ?? 0),
      name: obj.name?.toString() ?? "",
      description: obj.description?.toString() ?? "",
      developer: obj.developer?.toString() ?? "",
      publisher: obj.publisher?.toString() ?? "",
      genre: obj.genre?.toString() ?? "",
      image: obj.image?.toString() ?? "",
      color: obj.color?.toString() ?? "",
      clientUrl: obj.client_url?.toString() ?? "",
      rendererAddress: toHexAddress(obj.renderer_address ?? 0),
      royaltyFraction: BigInt(obj.royalty_fraction?.toString() ?? "0"),
      skillsAddress: obj.skills_address?.toString() ?? "",
      version: Number(obj.version ?? 0),
      createdAt: Number(obj.created_at ?? 0),
    };
  }, contract.address);
}

export async function rpcGameAddress(
  contract: Contract,
  gameId: number,
): Promise<string> {
  return wrapRpcCall(async () => {
    const result = await contract.call("game_address_from_id", [gameId]);
    return toHexAddress(result);
  }, contract.address);
}
