import { describe, it, expect, vi, afterEach } from "vitest";
import { apiGetTokens } from "../../src/api/tokens.js";

const ctx = {
  baseUrl: "http://api.test",
  fetchConfig: { maxRetries: 1, timeout: 5000, baseBackoff: 100, maxBackoff: 500 },
};

/** A minimal ok fetch response with a tokens page body. */
function okPage(total = 0) {
  return { ok: true, status: 200, json: () => Promise.resolve({ data: [], total }) };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("apiGetTokens — by-ids routing", () => {
  it("POSTs to /tokens/query with the id set + filters when tokenIds is set", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okPage());
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await apiGetTokens(ctx, {
      tokenIds: ["10", "20"],
      gameId: 1,
      gameOver: false,
      sort: { field: "score", direction: "desc" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api.test/tokens/query");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.tokenIds).toEqual(["10", "20"]);
    expect(body.gameId).toBe(1);
    expect(body.gameOver).toBe(false);
    // TokenSortField "score" maps to the API short name "score"
    expect(body.sort).toEqual({ field: "score", direction: "desc" });
  });

  it("maps sort field to the API short name in the POST body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okPage());
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await apiGetTokens(ctx, {
      tokenIds: ["1"],
      sort: { field: "mintedAt", direction: "asc" },
    });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.sort).toEqual({ field: "minted", direction: "asc" });
  });

  it("GETs /tokens (no id filter) when tokenIds is absent", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okPage());
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await apiGetTokens(ctx, { owner: "0xabc" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/tokens?");
    expect(url).not.toContain("/tokens/query");
    // apiFetch defaults to GET when no method is passed
    expect(init.method ?? "GET").toBe("GET");
    expect(init.body).toBeUndefined();
  });

  it("does NOT POST for an empty tokenIds array (falls through to GET)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okPage());
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await apiGetTokens(ctx, { tokenIds: [] });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/tokens?");
    expect(url).not.toContain("/tokens/query");
  });
});

describe("apiGetTokens — >500 id chunking", () => {
  it("splits into <=500-id POSTs and merges data + total", async () => {
    const ids = Array.from({ length: 501 }, (_, i) => String(i + 1));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okPage(500)) // first chunk of 500
      .mockResolvedValueOnce(okPage(1)); // last chunk of 1
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await apiGetTokens(ctx, { tokenIds: ids });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const b0 = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    const b1 = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
    expect(b0.tokenIds).toHaveLength(500);
    expect(b1.tokenIds).toHaveLength(1);
    // every chunk still hits the by-ids endpoint
    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/tokens/query");
    // totals summed across chunks
    expect(res.total).toBe(501);
  });

  it("does a single request for exactly 500 ids (no chunking)", async () => {
    const ids = Array.from({ length: 500 }, (_, i) => String(i + 1));
    const fetchMock = vi.fn().mockResolvedValue(okPage(500));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await apiGetTokens(ctx, { tokenIds: ids });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
