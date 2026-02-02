export interface ActivityEvent {
  id: string;
  type: string;
  token_id: string;
  game_id: number;
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
  total_events: number;
  events_by_type: Record<string, number>;
}
