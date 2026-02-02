import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiFetch, buildQueryString } from "../../src/api/base.js";
import { ApiError, TimeoutError } from "../../src/errors/index.js";

describe("buildQueryString", () => {
  it("should return empty string for no params", () => {
    expect(buildQueryString({})).toBe("");
  });

  it("should build query string from params", () => {
    const result = buildQueryString({ limit: 10, offset: 0 });
    expect(result).toBe("?limit=10&offset=0");
  });

  it("should skip undefined params", () => {
    const result = buildQueryString({ limit: 10, offset: undefined });
    expect(result).toBe("?limit=10");
  });

  it("should handle boolean params", () => {
    const result = buildQueryString({ active: true });
    expect(result).toBe("?active=true");
  });
});

describe("apiFetch", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it("should fetch data successfully", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [1, 2, 3] }),
    }) as unknown as typeof fetch;

    const result = await apiFetch<{ data: number[] }>({
      baseUrl: "http://localhost:3001",
      path: "/test",
      fetchConfig: { maxRetries: 1, timeout: 5000, baseBackoff: 100, maxBackoff: 500 },
    });

    expect(result).toEqual({ data: [1, 2, 3] });
  });

  it("should throw ApiError on non-ok response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: "Not found" }),
    }) as unknown as typeof fetch;

    await expect(
      apiFetch({
        baseUrl: "http://localhost:3001",
        path: "/missing",
        fetchConfig: { maxRetries: 1, timeout: 5000, baseBackoff: 100, maxBackoff: 500 },
      }),
    ).rejects.toThrow(ApiError);
  });
});
