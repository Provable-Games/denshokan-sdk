import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SORT_FIELD_TO_API, apiGetTokens } from "../../src/api/tokens.js";
import { apiGetPlayerTokens } from "../../src/api/players.js";

describe("SORT_FIELD_TO_API", () => {
  it("uses the short names the API expects", () => {
    // These values are what the denshokan API's sortFields lookup keys on —
    // sending the consumer name directly (e.g. "currentScore", "mintedAt",
    // "lastUpdatedAt") silently falls through to the default sort.
    expect(SORT_FIELD_TO_API).toEqual({
      score: "score",
      mintedAt: "minted",
      lastUpdatedAt: "updated",
      completedAt: "completedAt",
    });
  });
});

describe("apiGetTokens sort encoding", () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it.each([
    ["score", "score"],
    ["mintedAt", "minted"],
    ["lastUpdatedAt", "updated"],
    ["completedAt", "completedAt"],
  ] as const)("maps sort field %s to %s", async (field, expected) => {
    const captured: string[] = [];
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      captured.push(url);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [], total: 0 }),
      });
    }) as unknown as typeof fetch;

    await apiGetTokens(
      { baseUrl: "http://localhost:3001", fetchConfig: { maxRetries: 1, timeout: 5000, baseBackoff: 100, maxBackoff: 500 } },
      { sort: { field, direction: "desc" } },
    );

    const url = new URL(captured[0]);
    expect(url.searchParams.get("sort_by")).toBe(expected);
    expect(url.searchParams.get("sort_order")).toBe("desc");
  });
});

describe("apiGetPlayerTokens sort encoding", () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it("runs consumer sort field through the same API mapping", async () => {
    const captured: string[] = [];
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      captured.push(url);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [], total: 0 }),
      });
    }) as unknown as typeof fetch;

    await apiGetPlayerTokens(
      { baseUrl: "http://localhost:3001", fetchConfig: { maxRetries: 1, timeout: 5000, baseBackoff: 100, maxBackoff: 500 } },
      "0xabc",
      { sort: { field: "mintedAt", direction: "desc" } },
    );

    const url = new URL(captured[0]);
    expect(url.pathname).toBe("/players/0xabc/tokens");
    expect(url.searchParams.get("sort_by")).toBe("minted");
    expect(url.searchParams.get("sort_order")).toBe("desc");
  });
});
