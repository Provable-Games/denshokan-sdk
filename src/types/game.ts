export interface Game {
  id: number;
  name: string;
  description: string;
  contract_address: string;
  image_url?: string;
  created_at: string;
}

export interface GameStats {
  game_id: number;
  total_tokens: number;
  active_tokens: number;
  total_players: number;
  highest_score: number;
}

export interface LeaderboardEntry {
  token_id: string;
  owner: string;
  score: number;
  player_name: string;
  rank: number;
}

export interface LeaderboardPosition {
  token_id: string;
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
