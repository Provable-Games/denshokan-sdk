export interface PlayerStats {
  address: string;
  totalTokens: number;
  activeTokens: number;
  gamesPlayed: number;
  highestScore: number;
}

export interface PlayerTokensParams {
  gameId?: number;
  limit?: number;
  offset?: number;
}
