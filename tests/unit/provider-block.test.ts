import { describe, it, expect } from "vitest";
import { resolveReadBlock } from "../../src/rpc/provider.js";

// The createProvider wrapper routes every read's block through resolveReadBlock so
// starknet.js's default "pending" (dropped by RPC spec v0.10) can't throw
// "Block identifier unmanaged: pending".
describe("resolveReadBlock", () => {
  it("rewrites the dead 'pending' tag to 'latest'", () => {
    expect(resolveReadBlock("pending")).toBe("latest");
  });

  it("rewrites an absent block (undefined/null) to 'latest'", () => {
    expect(resolveReadBlock(undefined)).toBe("latest");
    expect(resolveReadBlock(null)).toBe("latest");
  });

  it("passes explicit blocks through unchanged", () => {
    expect(resolveReadBlock("latest")).toBe("latest");
    expect(resolveReadBlock("pre_confirmed")).toBe("pre_confirmed");
    expect(resolveReadBlock(12345)).toBe(12345);
    expect(resolveReadBlock("0xabc")).toBe("0xabc");
  });
});
