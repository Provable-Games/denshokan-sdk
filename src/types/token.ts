export interface Token {
  token_id: string;
  game_id: number;
  owner: string;
  score: number;
  game_over: boolean;
  player_name: string;
  minted_by: string;
  minted_at: string;
  settings_id: number;
  objective_id: number;
  soulbound: boolean;
  is_playable: boolean;
  game_address: string;
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
  game_id: number;
  settings_id: number;
  objective_id: number;
  player_name: string;
  minted_by: string;
  is_playable: boolean;
  is_soulbound: boolean;
  renderer_address: string;
  game_address: string;
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
  game_id?: number;
  owner?: string;
  game_over?: string;
  limit?: number;
  offset?: number;
}
