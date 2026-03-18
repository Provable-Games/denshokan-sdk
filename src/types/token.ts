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
  clientUrl?: string;
  rendererAddress?: string;
  skillsAddress?: string;
  startDelay: number;
  endDelay: number;
  hasContext: boolean;
  paymaster: boolean;
  /** Context ID (e.g., tournament ID for tournament-minted tokens) */
  contextId: number | null;
  /** Structured context data from the minting contract */
  contextData: {
    name: string;
    description: string;
    context: Array<{ name: string; value: string }>;
  } | null;
  /** Token URI (only populated when explicitly requested via includeUri option) */
  tokenUri?: string;
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
  /** Filter by game ID (resolved to game address via registry) */
  gameId?: number;
  /** Filter by game contract address directly */
  gameAddress?: string;
  /** Filter by owner address */
  owner?: string;
  /** Filter by settings ID (requires gameId or gameAddress) */
  settingsId?: number;
  /** Filter by objective ID (requires gameId or gameAddress) */
  objectiveId?: number;
  /** Filter by minter address */
  minterAddress?: string;
  /** Filter by soulbound status */
  soulbound?: boolean;
  /** Filter by playable status (active games) */
  playable?: boolean;
  /** Filter by game over status */
  gameOver?: boolean;
  /** Filter by context ID (e.g., tournament ID for tournament-minted tokens) */
  contextId?: number;
  /** Filter by context name (e.g., "Budokan" for tournament tokens) */
  contextName?: string;
  /** Filter by minted time range (unix timestamps) */
  mintedAfter?: number;
  mintedBefore?: number;
  /** Pagination */
  limit?: number;
  offset?: number;
  /** When true, fetches token URIs via batch RPC and populates Token.tokenUri */
  includeUri?: boolean;
}
