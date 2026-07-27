import { describe, it, expect, vi, afterEach } from "vitest";
import { DenshokanClient } from "../../src/client.js";

/**
 * The URI-enrichment step exists for one case: the caller wants tokenUri and
 * the API could not answer, so we read it on-chain instead.
 *
 * It must NOT fire when the API *did* answer. Since the SDK now sends
 * include_uri explicitly, a healthy API returning rows without tokenUri is
 * giving an authoritative answer (the caller's origin is not in the server's
 * URI allowlist) — reaching for RPC there would put ~40 KB/token of on-chain
 * reads behind every list call while the API is up and perfectly fine.
 */

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function client() {
  return new DenshokanClient({
    chain: "mainnet",
    apiUrl: "http://api.test",
    primarySource: "api",
  });
}

/** One token row, deliberately with no tokenUri — as an allowlist-denied API returns. */
function pageWithoutUri() {
  return {
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        data: [{ token_id: "1", tokenId: "1", game_id: 1, current_score: "5" }],
        total: 1,
      }),
  };
}

describe("tokenUri enrichment only backstops an unreachable API", () => {
  it("does not hit RPC when the API served the response without a tokenUri", async () => {
    const c = client();
    globalThis.fetch = vi.fn().mockResolvedValue(pageWithoutUri()) as unknown as typeof fetch;
    const uriBatch = vi.spyOn(c, "tokenUriBatch").mockResolvedValue(["data:image/svg+xml;base64,AAA"]);

    const res = await c.getTokens({ owner: "0xabc", includeUri: true });

    expect(uriBatch).not.toHaveBeenCalled();
    expect(res.data[0]?.tokenUri).toBeFalsy();
  });

  it("still skips RPC when the caller never asked for a tokenUri", async () => {
    const c = client();
    globalThis.fetch = vi.fn().mockResolvedValue(pageWithoutUri()) as unknown as typeof fetch;
    const uriBatch = vi.spyOn(c, "tokenUriBatch").mockResolvedValue([]);

    await c.getTokens({ owner: "0xabc" });

    expect(uriBatch).not.toHaveBeenCalled();
  });
});
