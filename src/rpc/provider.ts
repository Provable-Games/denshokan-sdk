import type { RpcProvider, Contract } from "starknet";

export function createProvider(rpcUrl: string): RpcProvider {
  // Dynamic import to avoid hard dependency
  const { RpcProvider: StarknetRpcProvider } = require("starknet") as typeof import("starknet");
  return new StarknetRpcProvider({ nodeUrl: rpcUrl });
}

export function createContract(
  abi: unknown[],
  address: string,
  provider: RpcProvider,
): Contract {
  const { Contract: StarknetContract } = require("starknet") as typeof import("starknet");
  return new StarknetContract(abi as any[], address, provider);
}
