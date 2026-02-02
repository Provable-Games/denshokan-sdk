import type { DecodedTokenId } from "../types/token.js";

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
  MINTED_AT: 100n,
  START_DELAY: 135n,
  END_DELAY: 160n,
  OBJECTIVE_ID: 185n,
  SOULBOUND: 215n,
  HAS_CONTEXT: 216n,
  PAYMASTER: 217n,
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
