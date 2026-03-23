export type WSChannel = "tokens" | "scores" | "game_over" | "mints" | "games" | "minters" | "settings" | "objectives";

export interface WSMessage {
  channel: string;
  data: unknown;
  _timing?: { serverTs: number };
}

export interface WSSubscribeOptions {
  channels: WSChannel[];
  gameIds?: number[];
  contextIds?: number[];
  minterAddresses?: string[];
  owners?: string[];
  settingsIds?: number[];
  objectiveIds?: number[];
}

export type WSEventHandler = (message: WSMessage) => void;

// Per-channel payload interfaces (camelCase)

export interface ScoreEvent {
  tokenId: string;
  gameId: number;
  score: number;
  ownerAddress: string;
  playerName: string;
  contextId: number | null;
  mintedBy: number | null;
  settingsId: number | null;
  objectiveId: number | null;
}

export interface GameOverEvent {
  tokenId: string;
  gameId: number;
  score: number;
  ownerAddress: string;
  playerName: string;
  completedAllObjectives: boolean;
  contextId: number | null;
  mintedBy: number | null;
  settingsId: number | null;
  objectiveId: number | null;
}

export interface MintEvent {
  tokenId: string;
  gameId: number;
  ownerAddress: string;
  mintedBy: string;
  settingsId: number;
  contextId: number | null;
  objectiveId: number | null;
}

export type TokenUpdateEvent =
  | { type: "scoreUpdate"; tokenId: string; gameId: number; score: number }
  | { type: "gameOver"; tokenId: string; gameId: number; score: number }
  | { type: "minted"; tokenId: string; gameId: number; ownerAddress: string };

export interface NewGameEvent {
  gameId: number;
  contractAddress: string;
  name: string;
}

export interface NewMinterEvent {
  minterId: string;
  contractAddress: string;
  name: string;
  blockNumber: string;
}

export interface NewSettingEvent {
  gameAddress: string;
  settingsId: number;
  creatorAddress: string;
  settingsData: string | null;
}

export interface NewObjectiveEvent {
  gameAddress: string;
  objectiveId: number;
  creatorAddress: string;
  objectiveData: string | null;
}

// Channel → payload type map
export interface WSChannelPayloadMap {
  scores: ScoreEvent;
  game_over: GameOverEvent;
  mints: MintEvent;
  tokens: TokenUpdateEvent;
  games: NewGameEvent;
  minters: NewMinterEvent;
  settings: NewSettingEvent;
  objectives: NewObjectiveEvent;
}
