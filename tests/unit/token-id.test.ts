import { describe, it, expect } from "vitest";
import { decodePackedTokenId } from "../../src/utils/token-id.js";

/**
 * These pack their own bits from the spec rather than importing the decoder's
 * OFFSETS — a test that reused those constants would agree with any typo they
 * contained, which is exactly the failure mode a bit-packed layout invites.
 *
 *     0–34  minted_at  |  35–59  start_delay  |  60–84  end_delay
 *   85–100  settings_id| 101–126 minted_by    | 127     soulbound
 *  128–137  tx_hash    | 138–153 salt         | 154     paymaster
 *  155      has_context| 156–185 objective_id | 186–250 metadata
 */
describe("decodePackedTokenId", () => {
  it("decodes a zero token id", () => {
    const decoded = decodePackedTokenId(0n);
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
    const decoded = decodePackedTokenId(BigInt(timestamp));
    expect(decoded.mintedAt.getTime()).toBe(timestamp * 1000);
  });

  it("accepts string token ids", () => {
    const decoded = decodePackedTokenId("42");
    expect(decoded.tokenId).toBe(42n);
    expect(decoded.mintedAt.getTime()).toBe(42 * 1000);
  });

  it("decodes every field of a fully packed id", () => {
    const mintedAt = 1_800_000_000;
    const startDelay = 3_600;
    const endDelay = 86_400;
    const settingsId = 0xbeef; // fills all 16 bits
    const mintedBy = 0x3ff_ffffn; // fills all 26 bits
    const txHash = 0x3ff; // 10 bits
    const salt = 0xffff; // 16 bits
    const objectiveId = 0x3fff_ffff; // 30 bits
    const metadata = 0x1_ffff_ffff_ffff_ffffn; // 65 bits

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

    const decoded = decodePackedTokenId(packed);
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
  });

  it("keeps the three flags independent", () => {
    const soulbound = decodePackedTokenId(1n << 127n);
    expect(soulbound.soulbound).toBe(true);
    expect(soulbound.paymaster).toBe(false);
    expect(soulbound.hasContext).toBe(false);

    const paymaster = decodePackedTokenId(1n << 154n);
    expect(paymaster.paymaster).toBe(true);
    expect(paymaster.soulbound).toBe(false);
    expect(paymaster.hasContext).toBe(false);

    const hasContext = decodePackedTokenId(1n << 155n);
    expect(hasContext.hasContext).toBe(true);
    expect(hasContext.soulbound).toBe(false);
    expect(hasContext.paymaster).toBe(false);
  });

  it("holds metadata beyond Number.MAX_SAFE_INTEGER without losing precision", () => {
    // 65 bits does not fit a JS number — this is why metadata is a bigint.
    const metadata = 0x1_ffff_ffff_ffff_ffffn;
    expect(metadata).toBeGreaterThan(BigInt(Number.MAX_SAFE_INTEGER));
    const decoded = decodePackedTokenId(metadata << 186n);
    expect(decoded.metadata).toBe(metadata);
  });

  it("does not bleed a field into its neighbours", () => {
    // settings_id saturated: the 25-bit end_delay below it and the 26-bit
    // minted_by above it must both stay zero.
    const decoded = decodePackedTokenId(0xffffn << 85n);
    expect(decoded.settingsId).toBe(0xffff);
    expect(decoded.endDelay).toBe(0);
    expect(decoded.mintedBy).toBe(0n);
    expect(decoded.soulbound).toBe(false);
  });
});
