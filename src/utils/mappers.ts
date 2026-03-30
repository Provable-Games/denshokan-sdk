import type { Token, TokenScoreEntry, PaginatedResult, DecodedTokenId } from "../types/token.js";
import { decodePackedTokenId } from "./token-id.js";
import { toHexTokenId } from "./address.js";
import type {
  Game,
  GameStats,
  GameObjectiveDetails,
  GameSettingDetails,
} from "../types/game.js";
import type { PlayerStats } from "../types/player.js";
import type { Minter } from "../types/minter.js";
import type { ActivityEvent, ActivityStats } from "../types/activity.js";
import type { GameMetadata, GameFeeInfo, MintParams, PlayerNameUpdate } from "../types/rpc.js";
import { DenshokanError } from "../errors/index.js";
import { MAX_SALT } from "./salt.js";

// =========================================================================
// API response mappers (snake_case API JSON → camelCase types)
// =========================================================================

export function mapToken(raw: Record<string, unknown>): Token {
  const tokenId = toHexTokenId(raw.tokenId ?? raw.token_id ?? "0");

  // Decode token ID for immutable fields - fallback when API doesn't provide them
  let decoded: DecodedTokenId | null = null;
  try {
    if (tokenId && tokenId !== "0x0") decoded = decodePackedTokenId(tokenId);
  } catch {
    // Invalid or missing tokenId - proceed without decoded fallback
  }

  return {
    tokenId,
    // Prefer API value, fallback to decoded
    gameId: Number(raw.gameId ?? raw.game_id ?? decoded?.gameId ?? 0),
    owner: String(raw.ownerAddress ?? raw.owner_address ?? raw.owner ?? ""),
    score: Number(raw.currentScore ?? raw.current_score ?? raw.score ?? 0),
    gameOver: Boolean(raw.gameOver ?? raw.game_over),
    playerName: String(raw.playerName ?? raw.player_name ?? "") || null,
    mintedBy: Number(raw.mintedBy ?? raw.minted_by ?? (decoded ? Number(decoded.mintedBy) : 0)),
    minterAddress: (raw.minterAddress ?? raw.minter_address) != null ? String(raw.minterAddress ?? raw.minter_address) : null,
    mintedAt: String(raw.mintedAt ?? raw.minted_at ?? decoded?.mintedAt.toISOString() ?? ""),
    settingsId: Number(raw.settingsId ?? raw.settings_id ?? decoded?.settingsId ?? 0),
    objectiveId: Number(raw.objectiveId ?? raw.objective_id ?? decoded?.objectiveId ?? 0),
    soulbound: Boolean(raw.soulbound ?? decoded?.soulbound),
    isPlayable: Boolean(raw.isPlayable ?? raw.is_playable),
    gameAddress: String(raw.gameAddress ?? raw.game_address ?? ""),
    clientUrl: raw.clientUrl != null ? String(raw.clientUrl) : (raw.client_url != null ? String(raw.client_url) : undefined),
    rendererAddress: raw.rendererAddress != null ? String(raw.rendererAddress) : (raw.renderer_address != null ? String(raw.renderer_address) : undefined),
    skillsAddress: raw.skillsAddress != null ? String(raw.skillsAddress) : (raw.skills_address != null ? String(raw.skills_address) : undefined),
    // New fields from decoded token ID
    startDelay: Number(raw.startDelay ?? raw.start_delay ?? decoded?.startDelay ?? 0) || undefined,
    endDelay: Number(raw.endDelay ?? raw.end_delay ?? decoded?.endDelay ?? 0) || undefined,
    hasContext: Boolean(raw.hasContext ?? raw.has_context ?? decoded?.hasContext),
    paymaster: Boolean(raw.paymaster ?? decoded?.paymaster),
    contextId: raw.contextId != null || raw.context_id != null
      ? Number(raw.contextId ?? raw.context_id)
      : null,
    contextData: (raw.contextData ?? raw.context_data) != null
      ? (raw.contextData ?? raw.context_data) as Token["contextData"]
      : null,
    tokenUri: (raw.tokenUri ?? raw.token_uri) != null ? String(raw.tokenUri ?? raw.token_uri) : undefined,
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

export function mapTokenScoreEntry(raw: Record<string, unknown>): TokenScoreEntry {
  const ts = raw.blockTimestamp ?? raw.block_timestamp ?? raw.timestamp ?? null;
  return {
    score: Number(raw.score ?? 0),
    timestamp: ts != null ? String(ts) : "",
  };
}

export function mapTokenScoreEntries(raw: Record<string, unknown>[]): TokenScoreEntry[] {
  return raw.map(mapTokenScoreEntry);
}

export function mapGame(raw: Record<string, unknown>): Game {
  const skillsAddress = raw.skillsAddress ?? raw.skills_address;
  return {
    gameId: Number(raw.gameId ?? raw.game_id ?? 0),
    name: String(raw.name ?? ""),
    description: String(raw.description ?? ""),
    contractAddress: String(raw.contractAddress ?? raw.contract_address ?? ""),
    imageUrl: raw.image != null ? String(raw.image) : (raw.imageUrl != null ? String(raw.imageUrl) : undefined),
    developer: raw.developer != null ? String(raw.developer) : undefined,
    publisher: raw.publisher != null ? String(raw.publisher) : undefined,
    genre: raw.genre != null ? String(raw.genre) : undefined,
    color: raw.color != null ? String(raw.color) : undefined,
    clientUrl: raw.clientUrl != null ? String(raw.clientUrl) : (raw.client_url != null ? String(raw.client_url) : undefined),
    rendererAddress: raw.rendererAddress != null ? String(raw.rendererAddress) : (raw.renderer_address != null ? String(raw.renderer_address) : undefined),
    royaltyFraction: raw.royaltyFraction != null ? String(raw.royaltyFraction) : (raw.royalty_fraction != null ? String(raw.royalty_fraction) : undefined),
    skillsAddress: skillsAddress != null ? String(skillsAddress) : undefined,
    version: raw.version != null ? Number(raw.version) : undefined,
    license: raw.license != null ? String(raw.license) : undefined,
    gameFeeBps: raw.gameFeeBps != null ? Number(raw.gameFeeBps) : (raw.game_fee_bps != null ? Number(raw.game_fee_bps) : undefined),
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
    completedGames: Number(raw.completedGames ?? raw.completed_games ?? 0),
    activeGames: Number(raw.activeGames ?? raw.active_games ?? 0),
    uniquePlayers: Number(raw.uniquePlayers ?? raw.unique_players ?? 0),
  };
}

export function mapPlayerStats(raw: Record<string, unknown>): PlayerStats {
  return {
    address: String(raw.address ?? ""),
    totalTokens: Number(raw.totalTokens ?? raw.total_tokens ?? 0),
    gamesPlayed: Number(raw.gamesPlayed ?? raw.games_played ?? 0),
    completedGames: Number(raw.completedGames ?? raw.completed_games ?? 0),
    activeGames: Number(raw.activeGames ?? raw.active_games ?? 0),
    totalScore: String(raw.totalScore ?? raw.total_score ?? "0"),
  };
}

export function mapMinter(raw: Record<string, unknown>): Minter {
  return {
    id: String(raw.id ?? ""),
    minterId: String(raw.minterId ?? raw.minter_id ?? ""),
    name: String(raw.name ?? ""),
    contractAddress: String(raw.contractAddress ?? raw.contract_address ?? ""),
    createdAt: String(raw.createdAt ?? raw.created_at ?? ""),
    blockNumber: String(raw.blockNumber ?? raw.block_number ?? ""),
  };
}

export function mapMinters(raw: Record<string, unknown>[]): Minter[] {
  return raw.map(mapMinter);
}

export function mapActivityEvent(raw: Record<string, unknown>): ActivityEvent {
  return {
    id: String(raw.id ?? ""),
    type: String(raw.eventType ?? raw.event_type ?? raw.type ?? ""),
    tokenId: toHexTokenId(raw.tokenId ?? raw.token_id ?? "0"),
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
    gameId: Number(raw.gameId ?? raw.game_id ?? 0),
    totalTokens: Number(raw.totalTokens ?? raw.total_tokens ?? 0),
    completedGames: Number(raw.completedGames ?? raw.completed_games ?? 0),
    activeGames: Number(raw.activeGames ?? raw.active_games ?? 0),
    uniquePlayers: Number(raw.uniquePlayers ?? raw.unique_players ?? 0),
  };
}

export function mapGameMetadata(raw: Record<string, unknown>): GameMetadata {
  return {
    gameId: Number(raw.game_id ?? 0),
    contractAddress: String(raw.contract_address ?? ""),
    name: String(raw.name ?? ""),
    description: String(raw.description ?? ""),
    developer: String(raw.developer ?? ""),
    publisher: String(raw.publisher ?? ""),
    genre: String(raw.genre ?? ""),
    image: String(raw.image ?? ""),
    color: String(raw.color ?? ""),
    clientUrl: String(raw.client_url ?? ""),
    rendererAddress: String(raw.renderer_address ?? ""),
    royaltyFraction: BigInt(String(raw.royalty_fraction ?? 0)),
    skillsAddress: String(raw.skills_address ?? ""),
    version: Number(raw.version ?? 0),
    createdAt: Number(raw.created_at ?? 0),
  };
}

export function mapGameFeeInfo(raw: Record<string, unknown>): GameFeeInfo {
  return {
    license: String(raw.license ?? ""),
    feeNumerator: Number(raw.fee_numerator ?? 0),
  };
}

export function mapObjectiveDetails(raw: Record<string, unknown>): GameObjectiveDetails {
  return {
    id: Number(raw.objectiveId ?? raw.objective_id ?? raw.id ?? 0),
    gameAddress: String(raw.gameAddress ?? raw.game_address ?? ""),
    creatorAddress: String(raw.creatorAddress ?? raw.creator_address ?? ""),
    name: String(raw.name ?? ""),
    description: String(raw.description ?? ""),
    objectives: (raw.objectives as Record<string, string>) ?? {},
    blockNumber: String(raw.blockNumber ?? raw.block_number ?? ""),
    createdAt: String(raw.createdAt ?? raw.created_at ?? ""),
  };
}

export function mapObjectivesDetails(raw: Record<string, unknown>[]): GameObjectiveDetails[] {
  return raw.map(mapObjectiveDetails);
}

export function mapSettingDetails(raw: Record<string, unknown>): GameSettingDetails {
  return {
    id: Number(raw.settingsId ?? raw.settings_id ?? raw.id ?? 0),
    gameAddress: String(raw.gameAddress ?? raw.game_address ?? ""),
    creatorAddress: String(raw.creatorAddress ?? raw.creator_address ?? ""),
    name: String(raw.name ?? ""),
    description: String(raw.description ?? ""),
    settings: (raw.settings as Record<string, string>) ?? {},
    blockNumber: String(raw.blockNumber ?? raw.block_number ?? ""),
    createdAt: String(raw.createdAt ?? raw.created_at ?? ""),
  };
}

export function mapSettingsDetails(raw: Record<string, unknown>[]): GameSettingDetails[] {
  return raw.map(mapSettingDetails);
}

// =========================================================================
// Reverse mappers (camelCase SDK types → snake_case for RPC/API wire format)
// =========================================================================

export function mintParamsToSnake(p: MintParams): {
  game_id: number;
  settings_id: number;
  objective_id: number;
  player_name: string;
  skills_address: string;
  soulbound: boolean;
  to: string;
  salt: number;
  metadata: number;
} {
  const salt = p.salt ?? 0;
  const metadata = p.metadata ?? 0;
  if (!Number.isInteger(salt) || salt < 0 || salt > MAX_SALT) {
    throw new DenshokanError(`Invalid salt: ${salt} (must be an integer 0–${MAX_SALT})`);
  }
  if (!Number.isInteger(metadata) || metadata < 0) {
    throw new DenshokanError(`Invalid metadata: ${metadata} (must be a non-negative integer)`);
  }
  return {
    game_id: p.gameId,
    settings_id: p.settingsId,
    objective_id: p.objectiveId,
    player_name: p.playerName,
    skills_address: p.skillsAddress ?? "",
    soulbound: p.soulbound,
    to: p.to,
    salt,
    metadata,
  };
}

export function playerNameUpdateToSnake(u: PlayerNameUpdate): { token_id: string; name: string } {
  return {
    token_id: u.tokenId,
    name: u.name,
  };
}

// =========================================================================
// WebSocket event mappers (snake_case WS payload → camelCase event types)
// =========================================================================

import type {
  ScoreEvent,
  GameOverEvent,
  MintEvent,
  TokenUpdateEvent,
  NewGameEvent,
  NewMinterEvent,
  NewSettingEvent,
  NewObjectiveEvent,
  WSChannel,
} from "../types/websocket.js";

export function mapScoreEvent(raw: Record<string, unknown>): ScoreEvent {
  return {
    tokenId: String(raw.token_id ?? ""),
    gameId: Number(raw.game_id ?? 0),
    score: Number(raw.score ?? 0),
    ownerAddress: String(raw.owner_address ?? ""),
    playerName: String(raw.player_name ?? ""),
    contextId: raw.context_id != null ? Number(raw.context_id) : null,
    mintedBy: raw.minted_by != null ? Number(raw.minted_by) : null,
    settingsId: raw.settings_id != null ? Number(raw.settings_id) : null,
    objectiveId: raw.objective_id != null ? Number(raw.objective_id) : null,
  };
}

export function mapGameOverEvent(raw: Record<string, unknown>): GameOverEvent {
  return {
    tokenId: String(raw.token_id ?? ""),
    gameId: Number(raw.game_id ?? 0),
    score: Number(raw.score ?? 0),
    ownerAddress: String(raw.owner_address ?? ""),
    playerName: String(raw.player_name ?? ""),
    completedAllObjectives: Boolean(raw.completed_all_objectives),
    contextId: raw.context_id != null ? Number(raw.context_id) : null,
    mintedBy: raw.minted_by != null ? Number(raw.minted_by) : null,
    settingsId: raw.settings_id != null ? Number(raw.settings_id) : null,
    objectiveId: raw.objective_id != null ? Number(raw.objective_id) : null,
  };
}

export function mapMintEvent(raw: Record<string, unknown>): MintEvent {
  return {
    tokenId: String(raw.token_id ?? ""),
    gameId: Number(raw.game_id ?? 0),
    ownerAddress: String(raw.owner_address ?? ""),
    mintedBy: String(raw.minted_by ?? ""),
    settingsId: Number(raw.settings_id ?? 0),
    contextId: raw.context_id != null ? Number(raw.context_id) : null,
    objectiveId: raw.objective_id != null ? Number(raw.objective_id) : null,
  };
}

export function mapTokenUpdateEvent(raw: Record<string, unknown>): TokenUpdateEvent {
  const type = String(raw.type ?? "");
  const tokenId = String(raw.token_id ?? "");
  const gameId = Number(raw.game_id ?? 0);

  if (type === "game_over") {
    return { type: "gameOver", tokenId, gameId, score: Number(raw.score ?? 0) };
  }
  if (type === "minted") {
    return { type: "minted", tokenId, gameId, ownerAddress: String(raw.owner_address ?? "") };
  }
  // Default to scoreUpdate
  return { type: "scoreUpdate", tokenId, gameId, score: Number(raw.score ?? 0) };
}

export function mapNewGameEvent(raw: Record<string, unknown>): NewGameEvent {
  return {
    gameId: Number(raw.game_id ?? 0),
    contractAddress: String(raw.contract_address ?? ""),
    name: String(raw.name ?? ""),
  };
}

export function mapNewMinterEvent(raw: Record<string, unknown>): NewMinterEvent {
  return {
    minterId: String(raw.minter_id ?? ""),
    contractAddress: String(raw.contract_address ?? ""),
    name: String(raw.name ?? ""),
    blockNumber: String(raw.block_number ?? ""),
  };
}

export function mapNewSettingEvent(raw: Record<string, unknown>): NewSettingEvent {
  return {
    gameAddress: String(raw.game_address ?? ""),
    settingsId: Number(raw.settings_id ?? 0),
    creatorAddress: String(raw.creator_address ?? ""),
    settingsData: raw.settings_data != null ? String(raw.settings_data) : null,
  };
}

export function mapNewObjectiveEvent(raw: Record<string, unknown>): NewObjectiveEvent {
  return {
    gameAddress: String(raw.game_address ?? ""),
    objectiveId: Number(raw.objective_id ?? 0),
    creatorAddress: String(raw.creator_address ?? ""),
    objectiveData: raw.objective_data != null ? String(raw.objective_data) : null,
  };
}

// Lookup record keyed by channel name
export const WS_EVENT_MAPPERS: Record<WSChannel, (raw: Record<string, unknown>) => unknown> = {
  scores: mapScoreEvent,
  game_over: mapGameOverEvent,
  mints: mapMintEvent,
  tokens: mapTokenUpdateEvent,
  games: mapNewGameEvent,
  minters: mapNewMinterEvent,
  settings: mapNewSettingEvent,
  objectives: mapNewObjectiveEvent,
};
