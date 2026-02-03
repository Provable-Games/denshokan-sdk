export interface Game {
  gameId: number;
  name: string;
  description: string;
  contractAddress: string;
  imageUrl?: string;
  createdAt: string;
}

export interface GameStats {
  gameId: number;
  totalTokens: number;
  activeTokens: number;
  totalPlayers: number;
  highestScore: number;
}

export interface LeaderboardEntry {
  tokenId: string;
  owner: string;
  score: number;
  playerName: string;
  rank: number;
}

export interface LeaderboardPosition {
  tokenId: string;
  rank: number;
  score: number;
  surrounding: LeaderboardEntry[];
}

export interface LeaderboardParams {
  limit?: number;
  offset?: number;
}

export interface GameDetail {
  key: string;
  value: string;
}

export interface GameObjective {
  id: number;
  name: string;
  description: string;
}

export interface GameSettingDetails {
  id: number;
  name: string;
  description: string;
}

export interface GameSetting {
  id: number;
  name: string;
  description: string;
}
