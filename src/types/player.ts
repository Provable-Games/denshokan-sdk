export interface PlayerStats {
  address: string;
  totalTokens: number;
  gamesPlayed: number;
  completedGames: number;
  activeGames: number;
  totalScore: string;
}

export interface PlayerTokensParams {
  gameId?: number;
  sort?: { field: string; direction: "asc" | "desc" };
  limit?: number;
  offset?: number;
  /** When true, fetches token URIs via batch RPC and populates Token.tokenUri */
  includeUri?: boolean;
}
