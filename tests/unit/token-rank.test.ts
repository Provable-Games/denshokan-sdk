import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mapTokenRank } from "../../src/utils/mappers.js";
import { apiGetTokenRank } from "../../src/api/tokens.js";
import { apiGetPlayerBestRank } from "../../src/api/players.js";

describe("mapTokenRank", () => {
  it("maps snake_case and camelCase fields", () => {
    expect(
      mapTokenRank({ token_id: "0x1", rank: 3, total: 100, score: "1500" }),
    ).toEqual({ tokenId: "0x1", rank: 3, total: 100, score: 1500 });

    expect(
      mapTokenRank({ tokenId: "0x1", rank: 3, total: 100, score: 1500 }),
    ).toEqual({ tokenId: "0x1", rank: 3, total: 100, score: 1500 });
  });

  it("defaults missing numeric fields to 0", () => {
    expect(mapTokenRank({})).toEqual({
      tokenId: "0x0",
      rank: 0,
      total: 0,
      score: 0,
    });
  });

  it("coerces score string to number", () => {
    const result = mapTokenRank({ token_id: "0x1", rank: 1, total: 1, score: "9007199254740991" });
    expect(result.score).toBe(9007199254740991);
  });
});

describe("apiGetTokenRank", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it("builds correct query string from scope params", async () => {
    const captured: string[] = [];
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      captured.push(url);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { token_id: "0x1", rank: 2, total: 10, score: "42" } }),
      });
    }) as unknown as typeof fetch;

    const result = await apiGetTokenRank(
      { baseUrl: "http://localhost:3001", fetchConfig: { maxRetries: 1, timeout: 5000, baseBackoff: 100, maxBackoff: 500 } },
      "0x1",
      {
        gameId: 7,
        settingsId: 2,
        contextId: 99,
        contextName: "Budokan",
        owner: "0xabc",
        minterAddress: "0xdef",
        gameOver: true,
        minScore: 10n,
        maxScore: 1000,
      },
    );

    expect(result).toEqual({ tokenId: "0x1", rank: 2, total: 10, score: 42 });
    expect(captured).toHaveLength(1);
    const url = new URL(captured[0]);
    expect(url.pathname).toBe("/tokens/0x1/rank");
    expect(url.searchParams.get("game_id")).toBe("7");
    expect(url.searchParams.get("settings_id")).toBe("2");
    expect(url.searchParams.get("context_id")).toBe("99");
    expect(url.searchParams.get("context_name")).toBe("Budokan");
    expect(url.searchParams.get("owner")).toBe("0xabc");
    expect(url.searchParams.get("minter_address")).toBe("0xdef");
    expect(url.searchParams.get("game_over")).toBe("true");
    expect(url.searchParams.get("min_score")).toBe("10");
    expect(url.searchParams.get("max_score")).toBe("1000");
  });

  it("omits undefined scope params", async () => {
    const captured: string[] = [];
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      captured.push(url);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { token_id: "0x1", rank: 1, total: 1, score: "0" } }),
      });
    }) as unknown as typeof fetch;

    await apiGetTokenRank(
      { baseUrl: "http://localhost:3001", fetchConfig: { maxRetries: 1, timeout: 5000, baseBackoff: 100, maxBackoff: 500 } },
      "0x1",
    );

    expect(captured[0]).toBe("http://localhost:3001/tokens/0x1/rank");
  });
});

describe("apiGetPlayerBestRank", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it("calls /players/:address/rank with scope params (no owner)", async () => {
    const captured: string[] = [];
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      captured.push(url);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          data: { token_id: "0xa", rank: 4, total: 50, score: "900" },
        }),
      });
    }) as unknown as typeof fetch;

    const result = await apiGetPlayerBestRank(
      { baseUrl: "http://localhost:3001", fetchConfig: { maxRetries: 1, timeout: 5000, baseBackoff: 100, maxBackoff: 500 } },
      "0xabc",
      { gameId: 3, contextId: 9, gameOver: false },
    );

    expect(result).toEqual({ tokenId: "0xa", rank: 4, total: 50, score: 900 });
    const url = new URL(captured[0]);
    expect(url.pathname).toBe("/players/0xabc/rank");
    expect(url.searchParams.get("game_id")).toBe("3");
    expect(url.searchParams.get("context_id")).toBe("9");
    expect(url.searchParams.get("game_over")).toBe("false");
    expect(url.searchParams.get("owner")).toBeNull();
  });
});
