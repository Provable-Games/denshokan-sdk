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
