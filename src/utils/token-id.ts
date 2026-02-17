import type { DecodedTokenId, CoreToken } from "../types/token.js";

/**
 * u128-aligned packed token ID layout (251 bits)
 *
 * Fields are arranged so the low u128 (bits 0–127) and high u128 (bits 128–250)
 * each form a contiguous block, enabling efficient DivRem unpacking on-chain.
 *
 * Bit range  Width  Field
 * ─────────  ─────  ──────────────
 *   0 – 29    30    game_id
 *  30 – 69    40    minted_by
 *  70 – 99    30    settings_id
 * 100 –124    25    start_delay
 * 125         1     soulbound
 * 126         1     has_context
 * 127         1     paymaster
 * ── u128 boundary ──────────────
 * 128 –162    35    minted_at
 * 163 –187    25    end_delay
 * 188 –217    30    objective_id
 * 218 –227    10    tx_hash
 * 228 –237    10    salt
 * 238 –250    13    metadata
 */

const MASKS = {
  GAME_ID: 0x3FFFFFFFn,
  MINTED_BY: 0xFFFFFFFFFFn,
  SETTINGS_ID: 0x3FFFFFFFn,
  MINTED_AT: 0x7FFFFFFFFn,
  START_DELAY: 0x1FFFFFFn,
  END_DELAY: 0x1FFFFFFn,
  OBJECTIVE_ID: 0x3FFFFFFFn,
  BOOL: 0x1n,
  TX_HASH: 0x3FFn,
  SALT: 0x3FFn,
  METADATA: 0x1FFFn,
} as const;

const OFFSETS = {
  GAME_ID: 0n,
  MINTED_BY: 30n,
  SETTINGS_ID: 70n,
  START_DELAY: 100n,
  SOULBOUND: 125n,
  HAS_CONTEXT: 126n,
  PAYMASTER: 127n,
  MINTED_AT: 128n,
  END_DELAY: 163n,
  OBJECTIVE_ID: 188n,
  TX_HASH: 218n,
  SALT: 228n,
  METADATA: 238n,
} as const;

export function decodePackedTokenId(tokenId: string | bigint): DecodedTokenId {
  const packed = typeof tokenId === "string" ? BigInt(tokenId) : tokenId;

  return {
    tokenId: packed,
    gameId: Number((packed >> OFFSETS.GAME_ID) & MASKS.GAME_ID),
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
    metadata: Number((packed >> OFFSETS.METADATA) & MASKS.METADATA),
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
    gameId: decoded.gameId,
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
