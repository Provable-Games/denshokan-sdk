export interface Game {
  gameId: number;
  name: string;
  description: string;
  contractAddress: string;
  imageUrl?: string;
  developer?: string;
  publisher?: string;
  genre?: string;
  color?: string;
  clientUrl?: string;
  rendererAddress?: string;
  royaltyFraction?: string;
  skillsAddress?: string;
  version?: number;
  createdAt: string;
}

export interface GameStats {
  gameId: number;
  totalTokens: number;
  completedGames: number;
  activeGames: number;
  uniquePlayers: number;
}

export interface GameDetail {
  key: string;
  value: string;
}

export interface GameObjectiveDetails {
  id: number;
  gameAddress: string;
  creatorAddress: string;
  name: string;
  description: string;
  objectives: Record<string, string>;
  blockNumber: string;
  createdAt: string;
}

export interface GameSettingDetails {
  id: number;
  gameAddress: string;
  creatorAddress: string;
  name: string;
  description: string;
  settings: Record<string, string>;
  blockNumber: string;
  createdAt: string;
}

export interface SettingsParams {
  limit?: number;
  offset?: number;
  gameAddress?: string;
}

export interface ObjectivesParams {
  limit?: number;
  offset?: number;
  gameAddress?: string;
}
