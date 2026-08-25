import type { DecodedTokenId, CoreToken } from "../types/token.js";

/**
 * The packed token ID layout (game-components v2.x).
 *
 * Every game IS its own ERC721, so a token's game is the contract that minted
 * it — there is no game_id field, and no registry to resolve one against.
 *
 * Bit range  Width  Field
 * ─────────  ─────  ──────────────
 *   0 – 34    35    minted_at
 *  35 – 59    25    start_delay
 *  60 – 84    25    end_delay
 *  85 –100    16    settings_id
 * 101 –126    26    minted_by
 * 127         1     soulbound
 * ── u128 boundary ──────────────
 * 128 –137    10    tx_hash
 * 138 –153    16    salt
 * 154         1     paymaster
 * 155         1     has_context
 * 156 –185    30    objective_id
 * 186 –250    65    metadata
 *
 * `minted_by` is a minter id from the issuing contract's own counter, not an
 * address, and it means nothing outside that contract. Likewise a token id is
 * unique only within its own ERC721: identity is (contract, token id).
 */

const MASKS = {
  MINTED_AT: 0x7FFFFFFFFn, // 35 bits
  START_DELAY: 0x1FFFFFFn, // 25
  END_DELAY: 0x1FFFFFFn, // 25
  SETTINGS_ID: 0xFFFFn, // 16
  MINTED_BY: 0x3FFFFFFn, // 26
  BOOL: 0x1n,
  TX_HASH: 0x3FFn, // 10
  SALT: 0xFFFFn, // 16
  OBJECTIVE_ID: 0x3FFFFFFFn, // 30
  METADATA: 0x1FFFFFFFFFFFFFFFFn, // 65
} as const;

const OFFSETS = {
  MINTED_AT: 0n,
  START_DELAY: 35n,
  END_DELAY: 60n,
  SETTINGS_ID: 85n,
  MINTED_BY: 101n,
  SOULBOUND: 127n,
  TX_HASH: 128n,
  SALT: 138n,
  PAYMASTER: 154n,
  HAS_CONTEXT: 155n,
  OBJECTIVE_ID: 156n,
  METADATA: 186n,
} as const;

/** Decode a packed token ID. */
export function decodePackedTokenId(tokenId: string | bigint): DecodedTokenId {
  const packed = typeof tokenId === "string" ? BigInt(tokenId) : tokenId;

  return {
    tokenId: packed,
    mintedBy: (packed >> OFFSETS.MINTED_BY) & MASKS.MINTED_BY,
    settingsId: Number((packed >> OFFSETS.SETTINGS_ID) & MASKS.SETTINGS_ID),
    mintedAt: new Date(Number((packed >> OFFSETS.MINTED_AT) & MASKS.MINTED_AT) * 1000),
    startDelay: Number((packed >> OFFSETS.START_DELAY) & MASKS.START_DELAY),
    endDelay: Number((packed >> OFFSETS.END_DELAY) & MASKS.END_DELAY),
    objectiveId: Number((packed >> OFFSETS.OBJECTIVE_ID) & MASKS.OBJECTIVE_ID),
    soulbound: ((packed >> OFFSETS.SOULBOUND) & MASKS.BOOL) === 1n,
    hasContext: ((packed >> OFFSETS.HAS_CONTEXT) & MASKS.BOOL) === 1n,
    paymaster: ((packed >> OFFSETS.PAYMASTER) & MASKS.BOOL) === 1n,
    txHash: Number((packed >> OFFSETS.TX_HASH) & MASKS.TX_HASH),
    salt: Number((packed >> OFFSETS.SALT) & MASKS.SALT),
    metadata: (packed >> OFFSETS.METADATA) & MASKS.METADATA,
  };
}

/**
 * Decode a packed token ID into a CoreToken.
 * Pure function - no RPC calls needed. Useful for quick client-side display.
 */
export function decodeCoreToken(tokenId: string | bigint): CoreToken {
  const decoded = decodePackedTokenId(tokenId);
  return {
    tokenId: typeof tokenId === "string" ? tokenId : tokenId.toString(),
    settingsId: decoded.settingsId,
    objectiveId: decoded.objectiveId,
    mintedAt: decoded.mintedAt.toISOString(),
    soulbound: decoded.soulbound,
    startDelay: decoded.startDelay,
    endDelay: decoded.endDelay,
    hasContext: decoded.hasContext,
    paymaster: decoded.paymaster,
    mintedByTruncated: decoded.mintedBy,
    txHash: decoded.txHash,
    salt: decoded.salt,
    metadata: decoded.metadata,
  };
}
