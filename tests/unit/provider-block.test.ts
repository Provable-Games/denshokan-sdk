import { describe, it, expect, vi } from "vitest";

// Record the block identifier every callContract receives, so we can assert the
// createProvider wrapper rewrites the dead "pending" tag (RPC spec v0.10) to "latest".
// Declared via vi.hoisted so it exists when the (hoisted) vi.mock factory runs.
const { seenBlocks } = vi.hoisted(() => ({ seenBlocks: [] as unknown[] }));

vi.mock("starknet", () => {
  class RpcProvider {
    nodeUrl: string;
    constructor(cfg: { nodeUrl: string }) {
      this.nodeUrl = cfg.nodeUrl;
    }
    callContract(_call: unknown, blockIdentifier?: unknown) {
      seenBlocks.push(blockIdentifier);
      return Promise.resolve(["0x0"]);
    }
  }
  return { RpcProvider };
});

import { createProvider } from "../../src/rpc/provider.js";

describe("createProvider — block-identifier rewrite", () => {
  it("rewrites absent/'pending' to 'latest' and passes real blocks through", async () => {
    seenBlocks.length = 0;
    const provider = await createProvider("http://rpc.test");

    await provider.callContract({} as never, "pending" as never);
    await provider.callContract({} as never); // undefined → default (Contract.call path)
    await provider.callContract({} as never, "latest" as never);
    await provider.callContract({} as never, 12345 as never); // explicit block number
    await provider.callContract({} as never, "0xabc" as never); // explicit block hash

    expect(seenBlocks).toEqual(["latest", "latest", "latest", 12345, "0xabc"]);
  });
});
