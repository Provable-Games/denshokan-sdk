import { afterEach, describe, expect, it, vi } from "vitest";
import { apiGetGameCoreLeaderboard } from "../../src/api/leaderboard.js";
import { DenshokanClient } from "../../src/client.js";

const params = { gameAddress: "0x1", minterAddress: "0xa", contextId: "7", limit: 1, offset: 10 };
const ctx = { baseUrl: "https://example.test", fetchConfig: { maxRetries: 1 } };
afterEach(() => vi.unstubAllGlobals());

describe("GameCore leaderboard query", () => {
  it("the public client method uses the API even with an RPC primary source", async () => {
    const data = [{ tokenId: "1", score: "9007199254740993", owner: "0xc", mintBlock: 0 }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data, total: 1 }))));
    const client = new DenshokanClient({ apiUrl: ctx.baseUrl, primarySource: "rpc" });
    try {
      expect((await client.getGameCoreLeaderboard(params)).data).toEqual(data);
    } finally {
      client.disconnect();
    }
  });
  it("preserves exact u64 strings and the server's mint-block ordering", async () => {
    const older = ((2n << 200n) | (10n << 32n)).toString();
    const newer = ((1n << 200n) | (11n << 32n)).toString();
    const data = [
      { tokenId: older, score: "18446744073709551615", owner: "0xc", mintBlock: 10 },
      { tokenId: newer, score: "18446744073709551615", owner: "0xd", mintBlock: 11 },
    ];
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data, total: 2 })));
    vi.stubGlobal("fetch", fetch);
    const result = await apiGetGameCoreLeaderboard(ctx, params);
    expect(result.data).toEqual(data);
    const url = new URL(fetch.mock.calls[0][0]);
    expect(url.pathname).toBe("/tokens/leaderboard");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      game_address: "0x1", minter_address: "0xa", context_id: "7",
      sort_order: "desc", limit: "1", offset: "10",
    });
  });

  it("keeps adjacent scores beyond Number.MAX_SAFE_INTEGER distinct", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ score: "9007199254740993" }, { score: "9007199254740992" }], total: 2,
    }))));
    expect((await apiGetGameCoreLeaderboard(ctx, params)).data.map((row) => row.score))
      .toEqual(["9007199254740993", "9007199254740992"]);
  });

  it.each([9007199254740992, "18446744073709551616", "-1"])(
    "rejects a rounded or invalid score %s", async (score) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ score }], total: 1 }))));
      await expect(apiGetGameCoreLeaderboard(ctx, params)).rejects.toThrow("exact u64 strings");
    },
  );

  it("fails when the new endpoint is unavailable instead of using a legacy query", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Not found" }), { status: 404 }));
    vi.stubGlobal("fetch", fetch);
    await expect(apiGetGameCoreLeaderboard(ctx, params)).rejects.toThrow("Not found");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
