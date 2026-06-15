import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { applyRpcBestEffortFilters, _resetRpcFilterWarnings } from "../../src/utils/rpc-filters.js";
import type { Token } from "../../src/types/token.js";

/** Build a Token with sensible defaults; override only what a test cares about. */
function tok(overrides: Partial<Token> = {}): Token {
  return {
    tokenId: "0x1",
    gameId: 1,
    owner: "0xowner",
    score: 0,
    gameOver: false,
    playerName: null,
    mintedBy: 0,
    minterAddress: null,
    mintedAt: "2026-01-01T00:00:00.000Z",
    settingsId: 0,
    objectiveId: 0,
    soulbound: false,
    isPlayable: true,
    gameAddress: "0xgame",
    hasContext: false,
    paymaster: false,
    contextId: null,
    contextName: null,
    lastUpdatedAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

describe("applyRpcBestEffortFilters", () => {
  beforeEach(() => {
    _resetRpcFilterWarnings();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes through when no params", () => {
    const tokens = [tok(), tok({ tokenId: "0x2", gameOver: true })];
    const r = applyRpcBestEffortFilters(tokens, 2, undefined);
    expect(r.tokens).toHaveLength(2);
    expect(r.total).toBe(2);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("best-effort filters gameOver:false and warns steering to playable", () => {
    const tokens = [tok({ tokenId: "0x1", gameOver: false }), tok({ tokenId: "0x2", gameOver: true })];
    const r = applyRpcBestEffortFilters(tokens, 2, { gameOver: false });
    expect(r.tokens.map((t) => t.tokenId)).toEqual(["0x1"]);
    // total becomes approximate (page count) once rows are dropped
    expect(r.total).toBe(1);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect((console.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0]).toContain("playable");
  });

  it("does not warn or change total when a filter removes nothing (native result)", () => {
    // Simulates a native gameOver=true viewer result: every row already matches.
    const tokens = [tok({ gameOver: true }), tok({ tokenId: "0x2", gameOver: true })];
    const r = applyRpcBestEffortFilters(tokens, 17, { gameOver: true });
    expect(r.tokens).toHaveLength(2);
    expect(r.total).toBe(17); // preserved, not overwritten
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("applies playable as a safety net for unsupported combinations", () => {
    const tokens = [tok({ isPlayable: true }), tok({ tokenId: "0x2", isPlayable: false })];
    const r = applyRpcBestEffortFilters(tokens, 2, { playable: true });
    expect(r.tokens.map((t) => t.tokenId)).toEqual(["0x1"]);
  });

  it("filters minted-time range client-side", () => {
    const tokens = [
      tok({ tokenId: "early", mintedAt: "2026-01-01T00:00:00.000Z" }), // 1767225600
      tok({ tokenId: "late", mintedAt: "2026-06-01T00:00:00.000Z" }),
    ];
    const r = applyRpcBestEffortFilters(tokens, 2, { mintedAfter: 1780000000 });
    expect(r.tokens.map((t) => t.tokenId)).toEqual(["late"]);
  });

  it("warns (no-op) for filters not expressible over RPC", () => {
    const tokens = [tok()];
    applyRpcBestEffortFilters(tokens, 1, { contextName: "Budokan" });
    applyRpcBestEffortFilters(tokens, 1, { sort: { field: "score", direction: "desc" } });
    expect(console.warn).toHaveBeenCalledTimes(2);
  });

  it("warns at most once per filter key", () => {
    const tokens = [tok({ gameOver: true })];
    applyRpcBestEffortFilters(tokens, 1, { gameOver: false });
    applyRpcBestEffortFilters(tokens, 1, { gameOver: false });
    expect(console.warn).toHaveBeenCalledTimes(1);
  });
});
