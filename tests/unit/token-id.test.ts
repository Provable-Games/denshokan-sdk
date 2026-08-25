import { describe, it, expect } from "vitest";
import { decodePackedTokenId } from "../../src/utils/token-id.js";

describe("decodePackedTokenId (legacy)", () => {
  it("should decode a zero token id", () => {
    const decoded = decodePackedTokenId(0n);
    expect(decoded.generation).toBe("legacy");
    expect(decoded.gameId).toBe(0);
    expect(decoded.mintedBy).toBe(0n);
    expect(decoded.settingsId).toBe(0);
    expect(decoded.objectiveId).toBe(0);
    expect(decoded.soulbound).toBe(false);
    expect(decoded.hasContext).toBe(false);
    expect(decoded.paymaster).toBe(false);
    expect(decoded.txHash).toBe(0);
    expect(decoded.salt).toBe(0);
    expect(decoded.metadata).toBe(0n);
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

/**
 * The standard layout shares no field offsets with the legacy one, so these
 * pack their own bits from the spec rather than reusing the decoder's own
 * constants — a test that imported STANDARD_OFFSETS would agree with any typo
 * those constants contained.
 *
 * STANDARD (game-components v2.x)
 *     0–34  minted_at  |  35–59  start_delay  |  60–84  end_delay
 *   85–100  settings_id | 101–126 minted_by   | 127     soulbound
 *  128–137  tx_hash    | 138–153 salt         | 154     paymaster
 *  155      has_context| 156–185 objective_id | 186–250 metadata
 */
describe("decodePackedTokenId (standard)", () => {
  it("decodes a zero token id, with no game id", () => {
    const decoded = decodePackedTokenId(0n, "standard");
    expect(decoded.generation).toBe("standard");
    // Self-bound: the game IS the contract, so there is nothing to decode.
    expect(decoded.gameId).toBeNull();
    expect(decoded.mintedBy).toBe(0n);
    expect(decoded.settingsId).toBe(0);
    expect(decoded.objectiveId).toBe(0);
    expect(decoded.soulbound).toBe(false);
    expect(decoded.hasContext).toBe(false);
    expect(decoded.paymaster).toBe(false);
    expect(decoded.txHash).toBe(0);
    expect(decoded.salt).toBe(0);
    expect(decoded.metadata).toBe(0n);
  });

  it("decodes mintedAt from the lowest 35 bits", () => {
    const timestamp = 1700000000;
    const decoded = decodePackedTokenId(BigInt(timestamp), "standard");
    expect(decoded.mintedAt.getTime()).toBe(timestamp * 1000);
  });

  it("decodes every field of a fully packed id", () => {
    const mintedAt = 1_800_000_000;
    const startDelay = 3_600;
    const endDelay = 86_400;
    const settingsId = 0xbeef; // fills all 16 bits
    const mintedBy = 0x3ff_ffffn; // fills all 26 bits
    const txHash = 0x3ff; // 10 bits
    const salt = 0xffff; // 16 bits — wider than legacy's 10
    const objectiveId = 0x3fff_ffff; // 30 bits
    const metadata = 0x1_ffff_ffff_ffff_ffffn; // 65 bits — wider than legacy's 13

    const packed =
      BigInt(mintedAt) |
      (BigInt(startDelay) << 35n) |
      (BigInt(endDelay) << 60n) |
      (BigInt(settingsId) << 85n) |
      (mintedBy << 101n) |
      (1n << 127n) | // soulbound
      (BigInt(txHash) << 128n) |
      (BigInt(salt) << 138n) |
      (1n << 154n) | // paymaster
      (1n << 155n) | // hasContext
      (BigInt(objectiveId) << 156n) |
      (metadata << 186n);

    const decoded = decodePackedTokenId(packed, "standard");
    expect(decoded.mintedAt.getTime()).toBe(mintedAt * 1000);
    expect(decoded.startDelay).toBe(startDelay);
    expect(decoded.endDelay).toBe(endDelay);
    expect(decoded.settingsId).toBe(settingsId);
    expect(decoded.mintedBy).toBe(mintedBy);
    expect(decoded.soulbound).toBe(true);
    expect(decoded.txHash).toBe(txHash);
    expect(decoded.salt).toBe(salt);
    expect(decoded.paymaster).toBe(true);
    expect(decoded.hasContext).toBe(true);
    expect(decoded.objectiveId).toBe(objectiveId);
    expect(decoded.metadata).toBe(metadata);
    expect(decoded.gameId).toBeNull();
  });

  it("keeps the three flags independent", () => {
    const soulbound = decodePackedTokenId(1n << 127n, "standard");
    expect(soulbound.soulbound).toBe(true);
    expect(soulbound.paymaster).toBe(false);
    expect(soulbound.hasContext).toBe(false);

    const paymaster = decodePackedTokenId(1n << 154n, "standard");
    expect(paymaster.paymaster).toBe(true);
    expect(paymaster.soulbound).toBe(false);
    expect(paymaster.hasContext).toBe(false);

    const hasContext = decodePackedTokenId(1n << 155n, "standard");
    expect(hasContext.hasContext).toBe(true);
    expect(hasContext.soulbound).toBe(false);
    expect(hasContext.paymaster).toBe(false);
  });

  it("holds metadata beyond Number.MAX_SAFE_INTEGER without losing precision", () => {
    // 65 bits does not fit a JS number — this is why metadata is a bigint.
    const metadata = 0x1_ffff_ffff_ffff_ffffn;
    expect(metadata).toBeGreaterThan(BigInt(Number.MAX_SAFE_INTEGER));
    const decoded = decodePackedTokenId(metadata << 186n, "standard");
    expect(decoded.metadata).toBe(metadata);
  });

  it("does not bleed a field into its neighbours", () => {
    // settings_id saturated: the 25-bit end_delay below it and the 26-bit
    // minted_by above it must both stay zero.
    const decoded = decodePackedTokenId(0xffffn << 85n, "standard");
    expect(decoded.settingsId).toBe(0xffff);
    expect(decoded.endDelay).toBe(0);
    expect(decoded.mintedBy).toBe(0n);
    expect(decoded.soulbound).toBe(false);
  });

  it("defaults to legacy, so existing call sites are unchanged", () => {
    // The same felt under both layouts. They share no offsets and the id
    // carries no marker, which is the whole reason generation is a parameter
    // rather than something the decoder can sniff.
    const packed = 42n;
    expect(decodePackedTokenId(packed).generation).toBe("legacy");
    expect(decodePackedTokenId(packed).gameId).toBe(42);
    expect(decodePackedTokenId(packed, "standard").gameId).toBeNull();
    expect(decodePackedTokenId(packed, "standard").mintedAt.getTime()).toBe(42 * 1000);
  });
});
