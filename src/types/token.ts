export interface Token {
  tokenId: string;
  gameId: number;
  owner: string;
  score: number;
  gameOver: boolean;
  playerName: string;
  /** 40-bit truncated minter address from token ID (not full address) */
  mintedBy: number;
  mintedAt: string;
  settingsId: number;
  objectiveId: number;
  soulbound: boolean;
  isPlayable: boolean;
  gameAddress: string;
  startDelay: number;
  endDelay: number;
  hasContext: boolean;
  paymaster: boolean;
}

/**
 * Core token data decoded purely from the packed token ID.
 * No RPC calls required - useful for quick client-side display.
 */
export interface CoreToken {
  tokenId: string;
  gameId: number;
  settingsId: number;
  objectiveId: number;
  mintedAt: string;
  soulbound: boolean;
  startDelay: number;
  endDelay: number;
  hasContext: boolean;
  paymaster: boolean;
  /** 40-bit truncated minter address (not full address) */
  mintedByTruncated: bigint;
  txHash: number;
  salt: number;
  metadata: number;
}

/**
 * Mutable token state that can change after minting.
 * Fetched via token_mutable_state RPC call.
 */
export interface TokenMutableState {
  gameOver: boolean;
  completedObjective: boolean;
}

export interface DecodedTokenId {
  tokenId: bigint;
  gameId: number;
  mintedBy: bigint;
  settingsId: number;
  mintedAt: Date;
  startDelay: number;
  endDelay: number;
  objectiveId: number;
  soulbound: boolean;
  hasContext: boolean;
  paymaster: boolean;
  txHash: number;
  salt: number;
  metadata: number;
}

export interface TokenMetadata {
  gameId: number;
  settingsId: number;
  objectiveId: number;
  playerName: string;
  mintedBy: string;
  isPlayable: boolean;
  isSoulbound: boolean;
  rendererAddress: string;
  gameAddress: string;
}

export interface TokenScoreEntry {
  score: number;
  timestamp: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
}

export interface TokensFilterParams {
  gameId?: number;
  owner?: string;
  gameOver?: string;
  limit?: number;
  offset?: number;
}
