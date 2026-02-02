import { describe, it, expect, vi, beforeEach } from "vitest";
import { withFallback } from "../../src/datasource/resolver.js";
import { ConnectionStatus } from "../../src/datasource/health.js";
import { DataSourceError } from "../../src/errors/index.js";

describe("withFallback", () => {
  it("should return primary result when primary succeeds", async () => {
    const primary = vi.fn().mockResolvedValue("primary-result");
    const fallback = vi.fn().mockResolvedValue("fallback-result");

    const result = await withFallback(primary, fallback);
    expect(result).toBe("primary-result");
    expect(fallback).not.toHaveBeenCalled();
  });

  it("should fall back when primary fails", async () => {
    const primary = vi.fn().mockRejectedValue(new Error("primary failed"));
    const fallback = vi.fn().mockResolvedValue("fallback-result");

    const result = await withFallback(primary, fallback);
    expect(result).toBe("fallback-result");
  });

  it("should throw DataSourceError when both fail", async () => {
    const primary = vi.fn().mockRejectedValue(new Error("primary failed"));
    const fallback = vi.fn().mockRejectedValue(new Error("fallback failed"));

    await expect(withFallback(primary, fallback)).rejects.toThrow(DataSourceError);
  });

  it("should skip primary in rpc-fallback mode", async () => {
    const primary = vi.fn().mockResolvedValue("primary-result");
    const fallback = vi.fn().mockResolvedValue("fallback-result");

    // Create a health instance that's in rpc-fallback mode
    const health = new ConnectionStatus("http://fake-api", "http://fake-rpc");
    // Force rpc-fallback mode by marking API unavailable
    health.markApiUnavailable("down");

    const result = await withFallback(primary, fallback, health);
    expect(result).toBe("fallback-result");
    expect(primary).not.toHaveBeenCalled();

    health.destroy();
  });
});
