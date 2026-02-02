export interface RoyaltyInfo {
  receiver: string;
  amount: bigint;
}

export interface GameMetadata {
  game_id: number;
  name: string;
  contract_address: string;
}

export interface MintParams {
  game_id: number;
  settings_id: number;
  objective_id: number;
  player_name: string;
  soulbound: boolean;
  to: string;
}

export interface PlayerNameUpdate {
  token_id: string;
  name: string;
}
