export interface ActivityEvent {
  id: string;
  type: string;
  tokenId: string;
  gameId: number;
  player: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface ActivityParams {
  type?: string;
  limit?: number;
  offset?: number;
}

export interface ActivityStats {
  gameId: number;
  totalTokens: number;
  completedGames: number;
  activeGames: number;
  uniquePlayers: number;
}
