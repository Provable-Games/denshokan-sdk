import type { Token, PaginatedResult } from "../types/token.js";
import type { Game, GameStats, LeaderboardEntry, LeaderboardPosition } from "../types/game.js";
import type { PlayerStats } from "../types/player.js";
import type { Minter } from "../types/minter.js";
import type { ActivityEvent, ActivityStats } from "../types/activity.js";
import type { GameMetadata, MintParams, PlayerNameUpdate } from "../types/rpc.js";

// =========================================================================
// API response mappers (snake_case API JSON → camelCase types)
// =========================================================================

export function mapToken(raw: Record<string, unknown>): Token {
  return {
    tokenId: String(raw.tokenId ?? raw.token_id ?? ""),
    gameId: Number(raw.gameId ?? raw.game_id ?? 0),
    owner: String(raw.ownerAddress ?? raw.owner_address ?? raw.owner ?? ""),
    score: Number(raw.currentScore ?? raw.current_score ?? raw.score ?? 0),
    gameOver: Boolean(raw.gameOver ?? raw.game_over),
    playerName: String(raw.playerName ?? raw.player_name ?? ""),
    mintedBy: String(raw.mintedBy ?? raw.minted_by ?? ""),
    mintedAt: String(raw.mintedAt ?? raw.minted_at ?? ""),
    settingsId: Number(raw.settingsId ?? raw.settings_id ?? 0),
    objectiveId: Number(raw.objectiveId ?? raw.objective_id ?? 0),
    soulbound: Boolean(raw.soulbound),
    isPlayable: Boolean(raw.isPlayable ?? raw.is_playable),
    gameAddress: String(raw.gameAddress ?? raw.game_address ?? ""),
  };
}

export function mapTokens(raw: Record<string, unknown>[]): Token[] {
  return raw.map(mapToken);
}

export function mapPaginatedTokens(raw: { data: Record<string, unknown>[]; total: number }): PaginatedResult<Token> {
  return {
    data: mapTokens(raw.data),
    total: raw.total,
  };
}

export function mapGame(raw: Record<string, unknown>): Game {
  return {
    gameId: Number(raw.gameId ?? raw.game_id ?? 0),
    name: String(raw.name ?? ""),
    description: String(raw.description ?? ""),
    contractAddress: String(raw.contractAddress ?? raw.contract_address ?? ""),
    imageUrl: raw.image != null ? String(raw.image) : (raw.imageUrl != null ? String(raw.imageUrl) : undefined),
    createdAt: String(raw.createdAt ?? raw.created_at ?? ""),
  };
}

export function mapGames(raw: Record<string, unknown>[]): Game[] {
  return raw.map(mapGame);
}

export function mapGameStats(raw: Record<string, unknown>): GameStats {
  return {
    gameId: Number(raw.gameId ?? raw.game_id ?? 0),
    totalTokens: Number(raw.totalTokens ?? raw.total_tokens ?? 0),
    activeTokens: Number(raw.activeGames ?? raw.active_games ?? raw.activeTokens ?? raw.active_tokens ?? 0),
    totalPlayers: Number(raw.uniquePlayers ?? raw.unique_players ?? raw.totalPlayers ?? raw.total_players ?? 0),
    highestScore: Number(raw.highestScore ?? raw.highest_score ?? 0),
  };
}

export function mapLeaderboardEntry(raw: Record<string, unknown>): LeaderboardEntry {
  return {
    tokenId: String(raw.tokenId ?? raw.token_id ?? ""),
    owner: String(raw.ownerAddress ?? raw.owner_address ?? raw.owner ?? ""),
    score: Number(raw.score ?? 0),
    playerName: String(raw.playerName ?? raw.player_name ?? ""),
    rank: Number(raw.rank ?? 0),
  };
}

export function mapLeaderboardEntries(raw: Record<string, unknown>[]): LeaderboardEntry[] {
  return raw.map(mapLeaderboardEntry);
}

export function mapLeaderboardPosition(raw: Record<string, unknown>): LeaderboardPosition {
  return {
    tokenId: String(raw.tokenId ?? raw.token_id ?? ""),
    rank: Number(raw.rank ?? 0),
    score: Number(raw.score ?? 0),
    surrounding: ((raw.surrounding as Record<string, unknown>[]) ?? []).map(mapLeaderboardEntry),
  };
}

export function mapPlayerStats(raw: Record<string, unknown>): PlayerStats {
  return {
    address: String(raw.address ?? ""),
    totalTokens: Number(raw.totalTokens ?? raw.total_tokens ?? 0),
    activeTokens: Number(raw.activeTokens ?? raw.active_tokens ?? 0),
    gamesPlayed: Number(raw.gamesPlayed ?? raw.games_played ?? 0),
    highestScore: Number(raw.highestScore ?? raw.highest_score ?? 0),
  };
}

export function mapMinter(raw: Record<string, unknown>): Minter {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    address: String(raw.contractAddress ?? raw.contract_address ?? raw.address ?? ""),
    gameId: Number(raw.gameId ?? raw.game_id ?? 0),
    active: Boolean(raw.active),
  };
}

export function mapMinters(raw: Record<string, unknown>[]): Minter[] {
  return raw.map(mapMinter);
}

export function mapActivityEvent(raw: Record<string, unknown>): ActivityEvent {
  return {
    id: String(raw.id ?? ""),
    type: String(raw.eventType ?? raw.event_type ?? raw.type ?? ""),
    tokenId: String(raw.tokenId ?? raw.token_id ?? ""),
    gameId: Number(raw.gameId ?? raw.game_id ?? 0),
    player: String(raw.player ?? raw.ownerAddress ?? raw.owner_address ?? ""),
    data: (raw.eventData ?? raw.event_data ?? raw.data) as Record<string, unknown> ?? {},
    timestamp: String(raw.blockTimestamp ?? raw.block_timestamp ?? raw.timestamp ?? ""),
  };
}

export function mapActivityEvents(raw: Record<string, unknown>[]): ActivityEvent[] {
  return raw.map(mapActivityEvent);
}

export function mapActivityStats(raw: Record<string, unknown>): ActivityStats {
  return {
    totalEvents: Number(raw.totalEvents ?? raw.total_events ?? 0),
    eventsByType: (raw.eventsByType ?? raw.events_by_type) as Record<string, number> ?? {},
  };
}

export function mapGameMetadata(raw: Record<string, unknown>): GameMetadata {
  return {
    gameId: Number(raw.game_id ?? 0),
    name: String(raw.name ?? ""),
    contractAddress: String(raw.contract_address ?? ""),
  };
}

// =========================================================================
// Reverse mappers (camelCase SDK types → snake_case for RPC/API wire format)
// =========================================================================

export function mintParamsToSnake(p: MintParams): {
  game_id: number;
  settings_id: number;
  objective_id: number;
  player_name: string;
  soulbound: boolean;
  to: string;
} {
  return {
    game_id: p.gameId,
    settings_id: p.settingsId,
    objective_id: p.objectiveId,
    player_name: p.playerName,
    soulbound: p.soulbound,
    to: p.to,
  };
}

export function playerNameUpdateToSnake(u: PlayerNameUpdate): { token_id: string; name: string } {
  return {
    token_id: u.tokenId,
    name: u.name,
  };
}
