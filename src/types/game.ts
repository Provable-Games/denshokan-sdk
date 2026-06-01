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
  /** Number of objectives registered for this game's contract. Present
   *  on responses from the indexer API; undefined when the Game came
   *  from an RPC-only path. Consumers can treat undefined as "unknown"
   *  rather than zero. */
  objectivesCount?: number;
  /** Number of settings presets registered for this game's contract.
   *  Same nullability semantics as `objectivesCount`. */
  settingsCount?: number;
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
