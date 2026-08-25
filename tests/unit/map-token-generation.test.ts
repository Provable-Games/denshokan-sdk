import { describe, it, expect } from "vitest";
import { mapToken } from "../../src/utils/mappers.js";

/**
 * mapToken has to survive three shapes of API response at once: a legacy row,
 * a self-bound row, and a row from an API deployment that predates the
 * generation column entirely. The distinctions are easy to lose to a `??`
 * chain, which is what these pin.
 */
describe("mapToken — token generation", () => {
  it("keeps an explicitly null game_id null rather than reporting 0", () => {
    // A self-bound token has no game id. Collapsing that to 0 would read as a
    // real game id — and 0 is the legacy denshokan's own first game.
    const token = mapToken({
      token_id: "0x1",
      generation: "standard",
      contract_address: "0xgame",
      game_id: null,
      owner_address: "0xowner",
    });
    expect(token.gameId).toBeNull();
    expect(token.generation).toBe("standard");
    expect(token.contractAddress).toBe("0xgame");
  });

  it("maps a legacy row's numeric game_id unchanged", () => {
    const token = mapToken({
      token_id: "0x1",
      generation: "legacy",
      game_id: 7,
      owner_address: "0xowner",
    });
    expect(token.gameId).toBe(7);
    expect(token.generation).toBe("legacy");
  });

  it("defaults to legacy when the API omits generation", () => {
    // An API deployment that predates the column serves only legacy rows.
    const token = mapToken({ token_id: "0x1", game_id: 3, owner_address: "0xowner" });
    expect(token.generation).toBe("legacy");
    expect(token.gameId).toBe(3);
    expect(token.contractAddress).toBeNull();
  });

  it("decodes fallback fields with the row's own layout", () => {
    // Same felt, two generations. Under the standard layout the low 35 bits
    // are minted_at; under legacy they are game_id + minted_by. The API omits
    // minted_at here so the decoded fallback is what shows through — and it
    // must not be decoded with the wrong layout.
    const packed = (1_800_000_000).toString(16);
    const standard = mapToken({
      token_id: `0x${packed}`,
      generation: "standard",
      game_id: null,
      owner_address: "0xowner",
    });
    expect(standard.mintedAt).toBe(new Date(1_800_000_000 * 1000).toISOString());

    const legacy = mapToken({
      token_id: `0x${packed}`,
      generation: "legacy",
      owner_address: "0xowner",
    });
    // Legacy packs minted_at in the HIGH word, so this felt has none — the
    // two must not agree.
    expect(legacy.mintedAt).not.toBe(standard.mintedAt);
  });
});
