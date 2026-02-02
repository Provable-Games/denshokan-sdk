export type WSChannel = "tokens" | "scores" | "game_over" | "mints";

export interface WSMessage {
  channel: string;
  data: unknown;
  _timing?: { serverTs: number };
}

export interface WSSubscribeOptions {
  channels: WSChannel[];
  gameIds?: number[];
}

export type WSEventHandler = (message: WSMessage) => void;
