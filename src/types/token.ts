export interface Token {
  tokenId: string;
  /**
   * LEGACY ONLY. `null` for self-bound tokens, whose game is a contract
   * address rather than a registry id — read `gameAddress` for those.
   *
   * The API returns null here for any token minted by a v2.x game, so this
   * has to be nullable to describe the response honestly.
   */
  gameId: number | null;
  /**
   * Which layout the indexer decoded this token with. Optional because an API
   * deployment that predates the self-bound generation does not return it;
   * absent means legacy.
   */
  generation?: TokenGeneration;
  /**
   * The ERC721 that issued this token. Together with `tokenId` it is the
   * token's identity — a token id is only unique within its own contract.
   * Optional for the same reason as `generation`.
   */
  contractAddress?: string | null;
  owner: string;
  score: number;
  gameOver: boolean;
  playerName: string | null;
  /**
   * Truncated minter id from the token id, NOT a full address — 40 bits on
   * legacy, 26 on standard. It is also scoped to `contractAddress`: the same
   * number means a different minter in another contract. Use `minterAddress`
   * for the resolved address.
   */
  mintedBy: number;
  /** Full minter contract address (resolved from minters registry) */
  minterAddress: string | null;
  /**
   * Original mint recipient (the `to` of the ERC-721 Transfer from 0x0).
   * Immutable — unlike `owner`, it never changes when the token transfers.
   * Null for tokens indexed before the minted_to column existed and not yet
   * backfilled.
   */
  mintedTo: string | null;
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
  /** Context name (e.g., tournament name) */
  contextName: string | null;
  /** Last time this token's mutable state was updated (ISO 8601) */
  lastUpdatedAt: string;
  /** Unix timestamp when the game was completed (null if still active) */
  completedAt: number | null;
  /** Token URI (only populated when explicitly requested via includeUri option) */
  tokenUri?: string;
}

/**
 * Which contract generation minted a token, and therefore which bit layout its
 * id uses.
 *
 * - `legacy`   — the registry-backed denshokan: one token contract serving
 *                many games, hence a `gameId` in the layout.
 * - `standard` — game-components v2.x: the game contract IS the token, so
 *                there is no game id to pack.
 *
 * The two layouts share no field offsets and ids carry no marker, so this has
 * to come from the contract a token was minted by — it cannot be inferred
 * from the id, and guessing wrong is silent rather than an error.
 */
export type TokenGeneration = "legacy" | "standard";

/**
 * Core token data decoded purely from the packed token ID.
 * No RPC calls required - useful for quick client-side display.
 */
export interface CoreToken {
  tokenId: string;
  /** Which layout decoded this token. */
  generation: TokenGeneration;
  /** LEGACY ONLY — `null` for self-bound tokens, whose game IS their contract. */
  gameId: number | null;
  settingsId: number;
  objectiveId: number;
  mintedAt: string;
  soulbound: boolean;
  startDelay: number;
  endDelay: number;
  hasContext: boolean;
  paymaster: boolean;
  /** Truncated minter id (legacy 40 bits, standard 26) — not a full address */
  mintedByTruncated: bigint;
  txHash: number;
  /** Legacy 10 bits, standard 16 */
  salt: number;
  /**
   * Inert game-interpreted data. 13 bits on legacy, 65 on standard — the
   * latter exceeds Number.MAX_SAFE_INTEGER, so this is a bigint for both
   * rather than silently rounding wide values.
   */
  metadata: bigint;
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
  /** Which layout decoded this token. */
  generation: TokenGeneration;
  /** LEGACY ONLY — `null` for self-bound tokens, whose game IS their contract. */
  gameId: number | null;
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
  /** See CoreToken.metadata — bigint to hold the standard layout's 65 bits. */
  metadata: bigint;
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
  /**
   * Scope the leaderboard to one game by contract address. Required for
   * self-bound games, which have no `gameId` — scoping those by `gameId`
   * silently produces a leaderboard with none of their tokens in it.
   */
  gameAddress?: string;
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

/**
 * Result shape for bulk rank lookups. `data` contains an entry per
 * requested tokenId that exists in scope; ids that don't match the scope
 * (or don't exist) are listed in `notFound`.
 */
export interface TokenRanksResult {
  data: TokenRank[];
  notFound: string[];
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
}

/**
 * Available sort fields for token queries.
 */
export type TokenSortField = "score" | "mintedAt" | "lastUpdatedAt" | "completedAt";

export interface TokensFilterParams {
  /** Filter by game ID (resolved to game address via registry) */
  gameId?: number;
  /** Filter by game contract address directly */
  gameAddress?: string;
  /** Filter by owner address */
  owner?: string;
  /** Filter to an explicit set of token ids. Use for a known id set — e.g. a
   *  player's whole campaign-minted game set — beyond the owner/minter paging and
   *  row limits. Sent to `POST /tokens/query` (an id list can be hundreds of
   *  felt252 values, too long for a query string). Combinable with the other
   *  filters (gameId/owner/gameOver/minterAddress) + sort. */
  tokenIds?: string[];
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
  sort?: { field: TokenSortField; direction: "asc" | "desc" };
  /** Pagination */
  limit?: number;
  offset?: number;
}

export interface TokensQueryParams extends TokensFilterParams {
  /** When true, fetches token URIs via batch RPC and populates Token.tokenUri */
  includeUri?: boolean;
}
