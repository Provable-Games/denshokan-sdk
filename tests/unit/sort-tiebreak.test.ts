import { describe, it, expect } from "vitest";
import { sortTokensWithTiebreak } from "../../src/utils/sort.js";
import type { Token } from "../../src/types/token.js";

function token(partial: Partial<Token> & { tokenId: string; score?: number; mintedAt?: string }): Token {
  return {
    tokenId: partial.tokenId,
    gameId: 0,
    settingsId: 0,
    objectiveId: 0,
    mintedAt: partial.mintedAt ?? "2024-01-01T00:00:00.000Z",
    soulbound: false,
    hasContext: false,
    paymaster: "0x0",
    mintedBy: 0,
    owner: "0x0",
    score: partial.score ?? 0,
    gameOver: false,
    playerName: null,
    isPlayable: true,
    gameAddress: "0x0",
    lastUpdatedAt: partial.mintedAt ?? "2024-01-01T00:00:00.000Z",
    contextId: null,
    contextName: null,
    completedAt: null,
    minterAddress: null,
    ...partial,
  } as Token;
}

describe("sortTokensWithTiebreak", () => {
  it("orders equal-score entries by earlier mintedAt first (matches contract wins_tiebreak)", () => {
    const tokens = [
      token({ tokenId: "0xA", score: 100, mintedAt: "2024-01-01T00:00:10.000Z" }),
      token({ tokenId: "0xB", score: 100, mintedAt: "2024-01-01T00:00:05.000Z" }),
      token({ tokenId: "0xC", score: 100, mintedAt: "2024-01-01T00:00:08.000Z" }),
    ];

    const sorted = sortTokensWithTiebreak(tokens, { field: "score", direction: "desc" });

    expect(sorted.map((t) => t.tokenId)).toEqual(["0xB", "0xC", "0xA"]);
  });

  it("falls back to lower tokenId when mintedAt is identical (matches contract fallback)", () => {
    const sameMint = "2024-01-01T00:00:00.000Z";
    const tokens = [
      token({ tokenId: "0x42", score: 50, mintedAt: sameMint }),
      token({ tokenId: "0x05", score: 50, mintedAt: sameMint }),
      token({ tokenId: "0x10", score: 50, mintedAt: sameMint }),
    ];

    const sorted = sortTokensWithTiebreak(tokens, { field: "score", direction: "desc" });

    expect(sorted.map((t) => t.tokenId)).toEqual(["0x05", "0x10", "0x42"]);
  });

  it("preserves descending score primary sort", () => {
    const tokens = [
      token({ tokenId: "0x1", score: 10, mintedAt: "2024-01-01T00:00:00.000Z" }),
      token({ tokenId: "0x2", score: 30, mintedAt: "2024-01-01T00:00:00.000Z" }),
      token({ tokenId: "0x3", score: 20, mintedAt: "2024-01-01T00:00:00.000Z" }),
    ];

    const sorted = sortTokensWithTiebreak(tokens, { field: "score", direction: "desc" });

    expect(sorted.map((t) => t.score)).toEqual([30, 20, 10]);
  });

  it("preserves ascending score primary sort", () => {
    const tokens = [
      token({ tokenId: "0x1", score: 10 }),
      token({ tokenId: "0x2", score: 30 }),
      token({ tokenId: "0x3", score: 20 }),
    ];

    const sorted = sortTokensWithTiebreak(tokens, { field: "score", direction: "asc" });

    expect(sorted.map((t) => t.score)).toEqual([10, 20, 30]);
  });

  it("applies only the tiebreak when no sort is provided", () => {
    const tokens = [
      token({ tokenId: "0x3", score: 0, mintedAt: "2024-01-01T00:00:30.000Z" }),
      token({ tokenId: "0x1", score: 100, mintedAt: "2024-01-01T00:00:10.000Z" }),
      token({ tokenId: "0x2", score: 50, mintedAt: "2024-01-01T00:00:20.000Z" }),
    ];

    const sorted = sortTokensWithTiebreak(tokens);

    // No primary sort — order purely by mintedAt asc, then tokenId asc
    expect(sorted.map((t) => t.tokenId)).toEqual(["0x1", "0x2", "0x3"]);
  });

  it("does not mutate the input array", () => {
    const tokens = [
      token({ tokenId: "0x2", score: 50 }),
      token({ tokenId: "0x1", score: 100 }),
    ];
    const original = [...tokens];

    sortTokensWithTiebreak(tokens, { field: "score", direction: "desc" });

    expect(tokens).toEqual(original);
  });

  it("handles mintedAt-sorted queries (primary == tiebreak field, no double work)", () => {
    const tokens = [
      token({ tokenId: "0xA", mintedAt: "2024-01-03T00:00:00.000Z" }),
      token({ tokenId: "0xB", mintedAt: "2024-01-01T00:00:00.000Z" }),
      token({ tokenId: "0xC", mintedAt: "2024-01-02T00:00:00.000Z" }),
    ];

    const sorted = sortTokensWithTiebreak(tokens, { field: "mintedAt", direction: "asc" });

    expect(sorted.map((t) => t.tokenId)).toEqual(["0xB", "0xC", "0xA"]);
  });
});
