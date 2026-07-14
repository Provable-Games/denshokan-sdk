import { describe, it, expect } from "vitest";
import { RpcProvider } from "starknet";
import { createProvider, createContract } from "../../src/rpc/provider.js";

// Guards the ASSUMPTION behind the createProvider block-rewrite: that starknet.js
// `Contract.call` funnels every read through `provider.callContract(call, block)`. If a
// future starknet version changes the call path (options object, different arg), this
// fails loudly instead of silently reintroducing the `pending` error. Complements the
// pure resolveReadBlock unit test (which can't observe the funnel).
const SCORE_BATCH_ABI = [
  {
    type: "function",
    name: "score_batch",
    inputs: [{ name: "token_ids", type: "core::array::Span::<core::felt252>" }],
    outputs: [{ type: "core::array::Array::<core::integer::u64>" }],
    state_mutability: "view",
  },
];

describe("createProvider — Contract.call funnel", () => {
  it("routes a defaulted Contract read through the wrapper as 'latest'", async () => {
    const seen: unknown[] = [];
    const orig = RpcProvider.prototype.callContract;
    // Stub the network layer at the prototype — createProvider binds this as its `raw`
    // callContract, so the wrapper calls it with the rewritten block. Returns a valid
    // empty Array<u64> (`["0x0"]` = length 0) so response parsing doesn't throw.
    (RpcProvider.prototype as unknown as { callContract: unknown }).callContract = function (
      _call: unknown,
      block?: unknown,
    ) {
      seen.push(block);
      return Promise.resolve(["0x0"]);
    };
    try {
      const provider = await createProvider("http://rpc.test");
      const contract = await createContract(SCORE_BATCH_ABI, "0x1", provider);
      await contract.call("score_batch", [["1"]]);
      // Contract.call passed no explicit block (or "pending") → wrapper → "latest".
      expect(seen).toEqual(["latest"]);
    } finally {
      (RpcProvider.prototype as unknown as { callContract: unknown }).callContract = orig;
    }
  });
});
