import type { DecodedTokenId, CoreToken, TokenGeneration } from "../types/token.js";

/**
 * There are two packed token ID layouts, and they share no field offsets.
 *
 * Both are a felt252 and NEITHER carries a marker saying which it is. Decoding
 * one with the other's layout does not throw — it returns a plausible
 * timestamp, a plausible settings id and a plausible minter id, all wrong. So
 * the generation has to come from the CONTRACT a token was minted by, and is
 * a parameter here rather than something this function can work out.
 *
 * LEGACY (registry-backed denshokan — one token contract, many games)
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
 *
 * STANDARD (game-components v2.x — the game contract IS the token)
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
 * Note there is no game_id: a self-bound token's game is the contract that
 * minted it. And metadata widens to 65 bits, which is why it is a bigint.
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

const STANDARD_MASKS = {
  MINTED_AT: 0x7FFFFFFFFn, // 35 bits
  START_DELAY: 0x1FFFFFFn, // 25
  END_DELAY: 0x1FFFFFFn, // 25
  SETTINGS_ID: 0xFFFFn, // 16 — narrower than legacy's 30
  MINTED_BY: 0x3FFFFFFn, // 26 — narrower than legacy's 40
  BOOL: 0x1n,
  TX_HASH: 0x3FFn, // 10
  SALT: 0xFFFFn, // 16 — wider than legacy's 10
  OBJECTIVE_ID: 0x3FFFFFFFn, // 30
  METADATA: 0x1FFFFFFFFFFFFFFFFn, // 65 — wider than legacy's 13
} as const;

const STANDARD_OFFSETS = {
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

/**
 * Decode a packed token ID.
 *
 * `generation` must come from the contract that minted the token — it cannot
 * be inferred from the id, and getting it wrong is silent rather than an
 * error. Defaults to `"legacy"`, which keeps every existing call site
 * behaving exactly as before.
 */
export function decodePackedTokenId(
  tokenId: string | bigint,
  generation: TokenGeneration = "legacy",
): DecodedTokenId {
  const packed = typeof tokenId === "string" ? BigInt(tokenId) : tokenId;

  if (generation === "standard") {
    return {
      tokenId: packed,
      generation: "standard",
      // Self-bound: the game is the contract that minted, not a packed field.
      gameId: null,
      mintedBy: (packed >> STANDARD_OFFSETS.MINTED_BY) & STANDARD_MASKS.MINTED_BY,
      settingsId: Number((packed >> STANDARD_OFFSETS.SETTINGS_ID) & STANDARD_MASKS.SETTINGS_ID),
      mintedAt: new Date(
        Number((packed >> STANDARD_OFFSETS.MINTED_AT) & STANDARD_MASKS.MINTED_AT) * 1000,
      ),
      startDelay: Number((packed >> STANDARD_OFFSETS.START_DELAY) & STANDARD_MASKS.START_DELAY),
      endDelay: Number((packed >> STANDARD_OFFSETS.END_DELAY) & STANDARD_MASKS.END_DELAY),
      objectiveId: Number((packed >> STANDARD_OFFSETS.OBJECTIVE_ID) & STANDARD_MASKS.OBJECTIVE_ID),
      soulbound: ((packed >> STANDARD_OFFSETS.SOULBOUND) & STANDARD_MASKS.BOOL) === 1n,
      hasContext: ((packed >> STANDARD_OFFSETS.HAS_CONTEXT) & STANDARD_MASKS.BOOL) === 1n,
      paymaster: ((packed >> STANDARD_OFFSETS.PAYMASTER) & STANDARD_MASKS.BOOL) === 1n,
      txHash: Number((packed >> STANDARD_OFFSETS.TX_HASH) & STANDARD_MASKS.TX_HASH),
      salt: Number((packed >> STANDARD_OFFSETS.SALT) & STANDARD_MASKS.SALT),
      metadata: (packed >> STANDARD_OFFSETS.METADATA) & STANDARD_MASKS.METADATA,
    };
  }

  return {
    tokenId: packed,
    generation: "legacy",
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
    metadata: (packed >> OFFSETS.METADATA) & MASKS.METADATA,
  };
}

/**
 * Decode a packed token ID into a CoreToken.
 * Pure function - no RPC calls needed. Useful for quick client-side display.
 */
export function decodeCoreToken(
  tokenId: string | bigint,
  generation: TokenGeneration = "legacy",
): CoreToken {
  const decoded = decodePackedTokenId(tokenId, generation);
  return {
    tokenId: typeof tokenId === "string" ? tokenId : tokenId.toString(),
    generation: decoded.generation,
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
