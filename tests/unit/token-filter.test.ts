import { describe, it, expect } from "vitest";
import { applyTokenFilters } from "../../src/utils/token-filter.js";
import type { Token } from "../../src/types/token.js";

function tok(overrides: Partial<Token>): Token {
  return {
    tokenId: "0x1",
    gameId: 1,
    owner: "0xabc",
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
    gameAddress: "0x0",
    hasContext: false,
    paymaster: false,
    contextId: null,
    contextName: null,
    lastUpdatedAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

const tokens = [
  tok({ tokenId: "0x1", gameId: 1, owner: "0xAAA", gameOver: false, settingsId: 5 }),
  tok({ tokenId: "0x2", gameId: 2, owner: "0xbbb", gameOver: true, settingsId: 5 }),
  tok({ tokenId: "0x3", gameId: 1, owner: "0xCCC", gameOver: true, settingsId: 9 }),
];
const ids = (list: Token[]) => list.map((t) => t.tokenId);

describe("applyTokenFilters", () => {
  it("returns all tokens when no filters are set", () => {
    expect(applyTokenFilters(tokens, {})).toHaveLength(3);
  });

  it("filters by gameId, gameOver, settingsId", () => {
    expect(ids(applyTokenFilters(tokens, { gameId: 1 }))).toEqual(["0x1", "0x3"]);
    expect(ids(applyTokenFilters(tokens, { gameOver: true }))).toEqual(["0x2", "0x3"]);
    expect(ids(applyTokenFilters(tokens, { settingsId: 9 }))).toEqual(["0x3"]);
  });

  it("filters by owner case-insensitively", () => {
    expect(ids(applyTokenFilters(tokens, { owner: "0xaaa" }))).toEqual(["0x1"]);
  });

  it("ANDs multiple filters", () => {
    expect(ids(applyTokenFilters(tokens, { gameId: 1, gameOver: true }))).toEqual(["0x3"]);
  });

  it("filters by hasContext / contextId / contextName", () => {
    const withCtx = [
      tok({ tokenId: "0xa", hasContext: true, contextId: 7, contextName: "Cup" }),
      tok({ tokenId: "0xb", hasContext: false, contextId: null, contextName: null }),
    ];
    expect(ids(applyTokenFilters(withCtx, { hasContext: true }))).toEqual(["0xa"]);
    expect(ids(applyTokenFilters(withCtx, { contextId: 7 }))).toEqual(["0xa"]);
    expect(ids(applyTokenFilters(withCtx, { contextName: "Cup" }))).toEqual(["0xa"]);
  });

  it("filters by soulbound / playable", () => {
    const list = [
      tok({ tokenId: "0x1", soulbound: true, isPlayable: false }),
      tok({ tokenId: "0x2", soulbound: false, isPlayable: true }),
    ];
    expect(ids(applyTokenFilters(list, { soulbound: true }))).toEqual(["0x1"]);
    expect(ids(applyTokenFilters(list, { playable: true }))).toEqual(["0x2"]);
  });

  it("filters by mintedAfter / mintedBefore (unix seconds vs ISO mintedAt)", () => {
    const list = [
      tok({ tokenId: "0x1", mintedAt: "2026-01-01T00:00:00.000Z" }),
      tok({ tokenId: "0x2", mintedAt: "2026-06-01T00:00:00.000Z" }),
    ];
    const mar = Math.floor(Date.parse("2026-03-01T00:00:00.000Z") / 1000);
    expect(ids(applyTokenFilters(list, { mintedAfter: mar }))).toEqual(["0x2"]);
    expect(ids(applyTokenFilters(list, { mintedBefore: mar }))).toEqual(["0x1"]);
  });

  it("does NOT filter by minterAddress (API-only in fallback)", () => {
    const list = [
      tok({ tokenId: "0x1", minterAddress: "0xMINT" }),
      tok({ tokenId: "0x2", minterAddress: null }),
    ];
    // minterAddress is intentionally ignored → all rows returned
    expect(applyTokenFilters(list, { minterAddress: "0xother" })).toHaveLength(2);
  });
});
