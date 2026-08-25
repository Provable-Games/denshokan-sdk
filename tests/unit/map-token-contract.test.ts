import { describe, it, expect } from "vitest";
import { mapToken } from "../../src/utils/mappers.js";

/**
 * A self-bound token's identity is (contract, token id) — the contract IS its
 * game. mapToken has to surface that from whichever spelling the API used,
 * because a token without its contract cannot be looked up again.
 */
describe("mapToken — contract identity", () => {
  it("maps contract_address from the API's snake_case", () => {
    const token = mapToken({
      token_id: "0x1",
      contract_address: "0xgame",
      owner_address: "0xowner",
    });
    expect(token.contractAddress).toBe("0xgame");
  });

  it("maps contractAddress from camelCase", () => {
    const token = mapToken({
      tokenId: "0x1",
      contractAddress: "0xgame",
      ownerAddress: "0xowner",
    });
    expect(token.contractAddress).toBe("0xgame");
  });

  it("falls back to gameAddress, which is the same contract", () => {
    // RPC-built rows name it gameAddress; for a self-bound token the game and
    // the issuing ERC721 are one address, so either spelling is the identity.
    const token = mapToken({
      token_id: "0x1",
      game_address: "0xgame",
      owner_address: "0xowner",
    });
    expect(token.contractAddress).toBe("0xgame");
  });

  it("decodes immutable fields from the id when the API omits them", () => {
    const mintedAt = 1_800_000_000;
    const token = mapToken({
      token_id: `0x${mintedAt.toString(16)}`,
      contract_address: "0xgame",
      owner_address: "0xowner",
    });
    expect(token.mintedAt).toBe(new Date(mintedAt * 1000).toISOString());
  });
});
