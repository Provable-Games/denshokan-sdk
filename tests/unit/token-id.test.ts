import { describe, it, expect } from "vitest";
import { decodePackedTokenId } from "../../src/utils/token-id.js";

describe("decodePackedTokenId", () => {
  it("should decode a zero token id", () => {
    const decoded = decodePackedTokenId(0n);
    expect(decoded.gameId).toBe(0);
    expect(decoded.mintedBy).toBe(0n);
    expect(decoded.settingsId).toBe(0);
    expect(decoded.objectiveId).toBe(0);
    expect(decoded.soulbound).toBe(false);
    expect(decoded.hasContext).toBe(false);
    expect(decoded.paymaster).toBe(false);
    expect(decoded.txHash).toBe(0);
    expect(decoded.salt).toBe(0);
    expect(decoded.metadata).toBe(0);
  });

  it("should decode gameId from lowest 30 bits", () => {
    const gameId = 42;
    const packed = BigInt(gameId);
    const decoded = decodePackedTokenId(packed);
    expect(decoded.gameId).toBe(gameId);
  });

  it("should decode settingsId from bits 70-99", () => {
    const settingsId = 7;
    const packed = BigInt(settingsId) << 70n;
    const decoded = decodePackedTokenId(packed);
    expect(decoded.settingsId).toBe(settingsId);
    expect(decoded.gameId).toBe(0);
  });

  it("should decode soulbound flag from bit 125", () => {
    const packed = 1n << 125n;
    const decoded = decodePackedTokenId(packed);
    expect(decoded.soulbound).toBe(true);
  });

  it("should decode hasContext flag from bit 126", () => {
    const packed = 1n << 126n;
    const decoded = decodePackedTokenId(packed);
    expect(decoded.hasContext).toBe(true);
    expect(decoded.soulbound).toBe(false);
  });

  it("should decode paymaster flag from bit 127", () => {
    const packed = 1n << 127n;
    const decoded = decodePackedTokenId(packed);
    expect(decoded.paymaster).toBe(true);
  });

  it("should decode objectiveId from bits 188-217", () => {
    const objectiveId = 100;
    const packed = BigInt(objectiveId) << 188n;
    const decoded = decodePackedTokenId(packed);
    expect(decoded.objectiveId).toBe(objectiveId);
  });

  it("should accept string token ids", () => {
    const decoded = decodePackedTokenId("42");
    expect(decoded.gameId).toBe(42);
    expect(decoded.tokenId).toBe(42n);
  });

  it("should decode mintedAt as a Date", () => {
    const timestamp = 1700000000;
    const packed = BigInt(timestamp) << 128n;
    const decoded = decodePackedTokenId(packed);
    expect(decoded.mintedAt.getTime()).toBe(timestamp * 1000);
  });

  it("should decode a complex packed token id with multiple fields", () => {
    // gameId=5, settingsId=3, objectiveId=10, soulbound=true
    const packed =
      5n |
      (3n << 70n) |
      (10n << 188n) |
      (1n << 125n);
    const decoded = decodePackedTokenId(packed);
    expect(decoded.gameId).toBe(5);
    expect(decoded.settingsId).toBe(3);
    expect(decoded.objectiveId).toBe(10);
    expect(decoded.soulbound).toBe(true);
    expect(decoded.hasContext).toBe(false);
  });
});
