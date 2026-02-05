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
  completedGames: number;
  activeGames: number;
  uniquePlayers: number;
}

export interface GameDetail {
  key: string;
  value: string;
}

export interface GameObjective {
  name: string;
  value: string;
}

export interface GameObjectiveDetails {
  id: number;
  name: string;
  description: string;
  objectives: GameObjective[];
}

export interface GameSetting {
  name: string;
  value: string;
}

export interface GameSettingDetails {
  id: number;
  name: string;
  description: string;
  settings: GameSetting[];
}

export interface DetailsParams {
  limit?: number;
  offset?: number;
}
