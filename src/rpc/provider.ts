import type { RpcProvider, Contract } from "starknet";

let starknetModule: typeof import("starknet") | null = null;
let useObjectConstructor: boolean | null = null;

async function getStarknet(): Promise<typeof import("starknet")> {
  if (!starknetModule) {
    starknetModule = await import("starknet");
  }
  return starknetModule;
}

/**
 * Resolve the block a read should run at. Starknet RPC spec v0.10 dropped the
 * "pending" tag, but starknet.js `Contract.call` still defaults to it → every read
 * throws `TypeError: Block identifier unmanaged: pending`. Rewrite an absent/"pending"
 * tag to "latest" (universally supported; ~1 block behind pre_confirmed — negligible
 * for score/state reads); pass any explicit block (number, hash, "latest", …) through.
 */
export function resolveReadBlock(blockIdentifier?: unknown): unknown {
  return blockIdentifier == null || blockIdentifier === "pending"
    ? "latest"
    : blockIdentifier;
}

export async function createProvider(
  rpcUrl: string,
  headers?: Record<string, string>,
): Promise<RpcProvider> {
  const { RpcProvider: StarknetRpcProvider } = await getStarknet();
  const provider = new StarknetRpcProvider({
    nodeUrl: rpcUrl,
    ...(headers && { headers }),
  });

  // Starknet RPC spec v0.10 dropped the "pending" block tag, but starknet.js
  // `Contract.call` still defaults to it → every read throws
  // `TypeError: Block identifier unmanaged: pending` (this is why `scoreBatch` and
  // the RPC token fallback were silently failing). Rewrite an absent/"pending" tag
  // to "latest" (universally supported across RPC providers; ~1 block behind
  // pre_confirmed — negligible for score/state reads) at the single choke point
  // every Contract.call funnels through. The funnel assumption (Contract.call →
  // provider.callContract(call, block)) is verified against starknet ^9.2.1 and
  // guarded by tests/unit/provider-funnel.test.ts so a peer-dep bump that changes
  // the call path fails CI instead of silently reintroducing the "pending" error.
  const rawCallContract = provider.callContract.bind(provider);
  (provider as unknown as { callContract: RpcProvider["callContract"] }).callContract = ((
    call: Parameters<RpcProvider["callContract"]>[0],
    blockIdentifier?: Parameters<RpcProvider["callContract"]>[1],
  ) => rawCallContract(call, resolveReadBlock(blockIdentifier) as never)) as RpcProvider["callContract"];

  return provider;
}

export async function createContract(
  abi: unknown[],
  address: string,
  provider: RpcProvider,
): Promise<Contract> {
  // Handle case where ABI might be wrapped in a default export
  let resolvedAbi = abi;
  if (abi && !Array.isArray(abi) && typeof abi === "object" && "default" in abi) {
    resolvedAbi = (abi as { default: unknown[] }).default;
  }

  const starknet = await getStarknet();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const StarknetContract = starknet.Contract as any;

  // Detect constructor style once and cache result
  if (useObjectConstructor === null) {
    // Try object format first (v7+), catch and try positional (v6.x)
    try {
      const contract = new StarknetContract({
        abi: resolvedAbi,
        address,
        providerOrAccount: provider,
      });
      // Object format works (v7+)
      useObjectConstructor = true;
      return contract as Contract;
    } catch {
      // Object format failed, use positional (v6.x)
      useObjectConstructor = false;
      return new StarknetContract(resolvedAbi, address, provider) as Contract;
    }
  }

  // Use cached constructor style
  if (useObjectConstructor) {
    return new StarknetContract({
      abi: resolvedAbi,
      address,
      providerOrAccount: provider,
    }) as Contract;
  } else {
    return new StarknetContract(resolvedAbi, address, provider) as Contract;
  }
}
