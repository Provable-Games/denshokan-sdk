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
  license?: string;
  gameFeeBps?: number;
  createdAt: string;
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
  sort?: { field: string; direction: "asc" | "desc" };
  limit?: number;
  offset?: number;
  gameAddress?: string;
}

export interface ObjectivesParams {
  sort?: { field: string; direction: "asc" | "desc" };
  limit?: number;
  offset?: number;
  gameAddress?: string;
}
