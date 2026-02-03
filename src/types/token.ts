export interface Token {
  tokenId: string;
  gameId: number;
  owner: string;
  score: number;
  gameOver: boolean;
  playerName: string;
  mintedBy: string;
  mintedAt: string;
  settingsId: number;
  objectiveId: number;
  soulbound: boolean;
  isPlayable: boolean;
  gameAddress: string;
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
