export interface Token {
  tokenId: string;
  gameId: number;
  owner: string;
  score: number;
  gameOver: boolean;
  playerName: string | null;
  /** 40-bit truncated minter address from token ID (not full address) */
  mintedBy: number;
  /** Full minter contract address (resolved from minters registry) */
  minterAddress: string | null;
  mintedAt: string;
  settingsId: number;
  objectiveId: number;
  soulbound: boolean;
  isPlayable: boolean;
  gameAddress: string;
  clientUrl?: string;
  rendererAddress?: string;
  skillsAddress?: string;
  startDelay?: number;
  endDelay?: number;
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

/** Rank of a token within a scoped leaderboard */
export interface TokenRank {
  tokenId: string;
  /** 1-indexed position (1 = top). Ties broken by earlier mintedAt. */
  rank: number;
  /** Total tokens matching the scope */
  total: number;
  /** The token's current score at the time of the query */
  score: number;
}

/**
 * Scope filters for ranking. The target token itself must match the scope —
 * if it doesn't, the SDK call rejects with TokenNotFoundError.
 */
export interface TokenRankParams {
  gameId?: number;
  settingsId?: number;
  objectiveId?: number;
  contextId?: number;
  contextName?: string;
  owner?: string;
  minterAddress?: string;
  gameOver?: boolean;
  minScore?: number | bigint;
  maxScore?: number | bigint;
}

/**
 * Scope filters for a player's best-rank query. Same shape as TokenRankParams
 * minus `owner` — the player address is passed separately.
 */
export type PlayerRankParams = Omit<TokenRankParams, "owner">;

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
  /** Filter to tokens that have a context (contextId != 0) or don't */
  hasContext?: boolean;
  /** Filter by context ID (e.g., tournament ID for tournament-minted tokens) */
  contextId?: number;
  /** Filter by context name (e.g., "Budokan" for tournament tokens) */
  contextName?: string;
  /** Filter by minted time range (unix timestamps) */
  mintedAfter?: number;
  mintedBefore?: number;
  /** Sort by field and direction */
  sort?: { field: string; direction: "asc" | "desc" };
  /** Pagination */
  limit?: number;
  offset?: number;
}

export interface TokensQueryParams extends TokensFilterParams {
  /** When true, fetches token URIs via batch RPC and populates Token.tokenUri */
  includeUri?: boolean;
}
