import { describe, it, expect } from "vitest";
import { configsEqual } from "../../src/utils/config-equal.js";
import type { DenshokanClientConfig } from "../../src/types/config.js";

describe("configsEqual", () => {
  it("treats two empty configs as equal", () => {
    expect(configsEqual({}, {})).toBe(true);
  });

  it("treats value-identical configs with different object identity as equal", () => {
    const make = (): DenshokanClientConfig => ({
      chain: "mainnet",
      rpcUrl: "https://rpc.example.com",
      denshokanAddress: "0xabc",
      primarySource: "rpc",
    });
    expect(configsEqual(make(), make())).toBe(true);
  });

  it("detects changes in primitive fields", () => {
    expect(
      configsEqual({ rpcUrl: "https://a.example.com" }, { rpcUrl: "https://b.example.com" }),
    ).toBe(false);
    expect(configsEqual({ chain: "mainnet" }, { chain: "sepolia" })).toBe(false);
  });

  it("treats an absent field and an explicit undefined as equal", () => {
    expect(configsEqual({ chain: "mainnet" }, { chain: "mainnet", rpcUrl: undefined })).toBe(true);
  });

  it("treats absent and explicit-undefined keys as equal inside nested objects", () => {
    expect(
      configsEqual(
        { fetch: { timeout: 5000, maxRetries: undefined } },
        { fetch: { timeout: 5000 } },
      ),
    ).toBe(true);
    expect(
      configsEqual(
        { fetch: { timeout: 5000, maxRetries: undefined } },
        { fetch: { timeout: 5000, maxRetries: 2 } },
      ),
    ).toBe(false);
  });

  it("detects a field present in only one config", () => {
    expect(configsEqual({}, { apiUrl: "https://api.example.com" })).toBe(false);
  });

  it("compares nested plain-object fields by value, one level deep", () => {
    const a: DenshokanClientConfig = {
      rpcHeaders: { Authorization: "Bearer x" },
      fetch: { timeout: 5000, maxRetries: 2 },
      health: { checkInterval: 30_000 },
    };
    const b: DenshokanClientConfig = {
      rpcHeaders: { Authorization: "Bearer x" },
      fetch: { timeout: 5000, maxRetries: 2 },
      health: { checkInterval: 30_000 },
    };
    expect(configsEqual(a, b)).toBe(true);

    expect(
      configsEqual(a, { ...b, rpcHeaders: { Authorization: "Bearer y" } }),
    ).toBe(false);
    expect(configsEqual(a, { ...b, fetch: { timeout: 9000, maxRetries: 2 } })).toBe(false);
    expect(configsEqual(a, { ...b, fetch: { timeout: 5000 } })).toBe(false);
  });

  it("compares class instances like provider by identity", () => {
    class FakeProvider {}
    const provider = new FakeProvider();
    expect(configsEqual({ provider }, { provider })).toBe(true);
    expect(configsEqual({ provider }, { provider: new FakeProvider() })).toBe(false);
  });

  it("covers fields it does not know about, so future config additions cannot go stale", () => {
    const a = { futureField: "a" } as DenshokanClientConfig;
    const b = { futureField: "b" } as DenshokanClientConfig;
    expect(configsEqual(a, b)).toBe(false);
    expect(configsEqual(a, { futureField: "a" } as DenshokanClientConfig)).toBe(true);
  });
});
