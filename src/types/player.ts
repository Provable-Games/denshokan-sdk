export interface PlayerStats {
  address: string;
  total_tokens: number;
  active_tokens: number;
  games_played: number;
  highest_score: number;
}

export interface PlayerTokensParams {
  game_id?: number;
  limit?: number;
  offset?: number;
}
