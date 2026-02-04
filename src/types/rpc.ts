export interface RoyaltyInfo {
  receiver: string;
  amount: bigint;
}

export interface GameMetadata {
  gameId: number;
  name: string;
  contractAddress: string;
}

export interface MintParams {
  gameId: number;
  settingsId: number;
  objectiveId: number;
  playerName: string;
  soulbound: boolean;
  to: string;
}

export interface PlayerNameUpdate {
  tokenId: string;
  name: string;
}

export interface FilterResult {
  tokenIds: string[];
  total: number;
}

export interface Lifecycle {
  start: number;
  end: number;
}

export interface TokenFullState {
  tokenId: string;
  owner: string;
  playerName: string;
  isPlayable: boolean;
  gameAddress: string;
  gameOver: boolean;
  completedObjective: boolean;
  lifecycle: Lifecycle;
}
