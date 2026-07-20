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

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
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

  it("forwards context filters in the POST body (parity with GET)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okPage());
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await apiGetTokens(ctx, {
      tokenIds: ["1"],
      hasContext: true,
      contextId: 7,
      contextName: "Budokan",
    });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.hasContext).toBe(true);
    expect(body.contextId).toBe(7);
    expect(body.contextName).toBe("Budokan");
  });

  it("returns an empty set WITHOUT fetching for an empty tokenIds array", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okPage());
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await apiGetTokens(ctx, { tokenIds: [] });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res).toEqual({ data: [], total: 0 });
  });
});

describe("apiGetTokens — >500 id chunking", () => {
  // Return one row per chunk with a known score, so merge order is observable.
  // The 1-id chunk scores 99, the 500-id chunk scores 10.
  function chunkScoreMock() {
    return vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      const score = body.tokenIds.length === 1 ? 99 : 10;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [{ token_id: body.tokenIds[0], score }], total: 1 }),
      });
    });
  }

  it("splits >500 ids into <=500-id POSTs", async () => {
    const ids = Array.from({ length: 501 }, (_, i) => String(i + 1));
    const fetchMock = chunkScoreMock();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await apiGetTokens(ctx, { tokenIds: ids });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const sizes = fetchMock.mock.calls
      .map((c) => JSON.parse((c[1] as RequestInit).body as string).tokenIds.length)
      .sort((a: number, b: number) => b - a);
    expect(sizes).toEqual([500, 1]);
    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/tokens/query");
  });

  it("re-sorts the merged result across chunks", async () => {
    const ids = Array.from({ length: 501 }, (_, i) => String(i + 1));
    globalThis.fetch = chunkScoreMock() as unknown as typeof fetch;

    const res = await apiGetTokens(ctx, {
      tokenIds: ids,
      sort: { field: "score", direction: "desc" },
    });

    // merged + re-sorted by score desc → the 99 row before the 10 row
    expect(res.data.map((t) => t.score)).toEqual([99, 10]);
    expect(res.total).toBe(2); // full matched count
  });

  it("applies limit/offset to the chunked merged result", async () => {
    const ids = Array.from({ length: 501 }, (_, i) => String(i + 1));
    globalThis.fetch = chunkScoreMock() as unknown as typeof fetch;

    const res = await apiGetTokens(ctx, {
      tokenIds: ids,
      sort: { field: "score", direction: "desc" },
      limit: 1,
    });

    expect(res.data.map((t) => t.score)).toEqual([99]); // top-1 after sort
    expect(res.total).toBe(2); // full matched count, not the sliced page size
  });

  it("does a single request for exactly 500 ids (no chunking)", async () => {
    const ids = Array.from({ length: 500 }, (_, i) => String(i + 1));
    const fetchMock = vi.fn().mockResolvedValue(okPage(500));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await apiGetTokens(ctx, { tokenIds: ids });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("apiGetTokens — includeUri controls the payload", () => {
  it("POST /tokens/query omits tokenUri by default (includeUri:false in body)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okPage());
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await apiGetTokens(ctx, { tokenIds: ["1"], gameId: 1 });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.includeUri).toBe(false);
  });

  it("POST /tokens/query requests tokenUri when includeUri:true (field omitted → server default)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okPage());
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await apiGetTokens(ctx, { tokenIds: ["1"], gameId: 1, includeUri: true });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect("includeUri" in body).toBe(false);
  });

  it("GET /tokens sends include_uri=false by default, omits it when includeUri:true", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okPage());
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await apiGetTokens(ctx, { owner: "0xabc" });
    expect(fetchMock.mock.calls[0][0]).toContain("include_uri=false");
    fetchMock.mockClear();
    await apiGetTokens(ctx, { owner: "0xabc", includeUri: true });
    expect(fetchMock.mock.calls[0][0]).not.toContain("include_uri");
  });
});
