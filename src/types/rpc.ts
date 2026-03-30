export interface RoyaltyInfo {
  receiver: string;
  amount: bigint;
}

export interface GameMetadata {
  gameId: number;
  contractAddress: string;
  name: string;
  description: string;
  developer: string;
  publisher: string;
  genre: string;
  image: string;
  color: string;
  clientUrl: string;
  rendererAddress: string;
  royaltyFraction: bigint;
  skillsAddress: string;
  version: number;
  createdAt: number;
}

export interface GameFeeInfo {
  license: string;
  feeNumerator: number;
}

export interface MintParams {
  gameId: number;
  settingsId: number;
  objectiveId: number;
  playerName: string;
  skillsAddress?: string;
  soulbound: boolean;
  to: string;
  salt?: number;
  metadata?: number;
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

export interface DenshokanTokenState extends TokenFullState {
  minterAddress: string;
  rendererAddress: string;
  skillsAddress: string;
  clientUrl: string;
}
