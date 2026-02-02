import type { Contract, RpcProvider } from "starknet";
import type {
  DenshokanClientConfig,
  ResolvedConfig,
  Game,
  GameStats,
  LeaderboardEntry,
  LeaderboardPosition,
  LeaderboardParams,
  GameObjective,
  GameSetting,
  GameSettingDetails,
  GameDetail,
  Token,
  TokenMetadata,
  TokenScoreEntry,
  PaginatedResult,
  TokensFilterParams,
  DecodedTokenId,
  PlayerStats,
  PlayerTokensParams,
  Minter,
  ActivityEvent,
  ActivityParams,
  ActivityStats,
  RoyaltyInfo,
  GameMetadata,
  MintParams,
  PlayerNameUpdate,
  WSSubscribeOptions,
  WSEventHandler,
} from "./types/index.js";
import { getChainConfig } from "./chains/constants.js";
import { DEFAULT_FETCH_CONFIG } from "./utils/retry.js";
import { decodePackedTokenId } from "./utils/token-id.js";
import { InvalidChainError } from "./errors/index.js";
import { ConnectionStatus } from "./datasource/health.js";
import { withFallback } from "./datasource/resolver.js";
import { WebSocketManager } from "./ws/manager.js";

// API imports
import {
  apiGetGames,
  apiGetGame,
  apiGetGameStats,
  apiGetGameLeaderboard,
  apiGetLeaderboardPosition,
  apiGetGameObjectives,
  apiGetGameSettings,
} from "./api/games.js";
import { apiGetTokens, apiGetToken, apiGetTokenScores } from "./api/tokens.js";
import { apiGetPlayerTokens, apiGetPlayerStats } from "./api/players.js";
import { apiGetMinters, apiGetMinter } from "./api/minters.js";
import { apiGetActivity, apiGetActivityStats } from "./api/activity.js";

// RPC imports
import { createProvider, createContract } from "./rpc/provider.js";
import {
  rpcBalanceOf,
  rpcOwnerOf,
  rpcTokenUri,
  rpcName,
  rpcSymbol,
  rpcRoyaltyInfo,
  rpcTokenMetadata,
  rpcTokenMetadataBatch,
  rpcIsPlayable,
  rpcIsPlayableBatch,
  rpcSettingsId,
  rpcSettingsIdBatch,
  rpcPlayerName,
  rpcPlayerNameBatch,
  rpcObjectiveId,
  rpcObjectiveIdBatch,
  rpcMintedBy,
  rpcMintedByBatch,
  rpcIsSoulbound,
  rpcIsSoulboundBatch,
  rpcRendererAddress,
  rpcRendererAddressBatch,
  rpcTokenGameAddress,
  rpcTokenGameAddressBatch,
  rpcMint,
  rpcMintBatch,
  rpcUpdateGame,
  rpcUpdateGameBatch,
  rpcUpdatePlayerName,
  rpcUpdatePlayerNameBatch,
} from "./rpc/denshokan.js";
import { rpcGameMetadata, rpcGameAddress } from "./rpc/registry.js";
import {
  rpcScore,
  rpcScoreBatch,
  rpcGameOver,
  rpcGameOverBatch,
  rpcTokenName,
  rpcTokenNameBatch,
  rpcTokenDescription,
  rpcTokenDescriptionBatch,
  rpcGameDetails,
  rpcGameDetailsBatch,
  rpcObjectiveExists,
  rpcObjectiveExistsBatch,
  rpcObjectivesDetails,
  rpcObjectivesDetailsBatch,
  rpcSettingsExists,
  rpcSettingsExistsBatch,
  rpcSettingsDetail,
  rpcSettingsDetailsBatch,
} from "./rpc/game.js";

// ABI
import denshokanAbi from "./rpc/abis/denshokan.json";

const DEFAULT_WS_CONFIG = {
  maxReconnectAttempts: 10,
  reconnectBaseDelay: 1000,
};

export class DenshokanClient {
  private readonly config: ResolvedConfig;
  private readonly connectionStatus: ConnectionStatus;
  private readonly wsManager: WebSocketManager;

  // Lazy-initialized RPC objects
  private _provider: RpcProvider | null = null;
  private _denshokanContract: Contract | null = null;
  private _registryContract: Contract | null = null;
  private _gameContracts = new Map<string, Contract>();
  private _gameAddressCache = new Map<number, string>();

  constructor(config: DenshokanClientConfig) {
    this.config = this.resolveConfig(config);
    this.connectionStatus = new ConnectionStatus(this.config.apiUrl, this.config.rpcUrl);
    this.wsManager = new WebSocketManager(this.config.wsUrl, {
      maxReconnectAttempts: this.config.ws.maxReconnectAttempts,
      reconnectBaseDelay: this.config.ws.reconnectBaseDelay,
    });
    this.connectionStatus.startMonitoring();
  }

  private resolveConfig(config: DenshokanClientConfig): ResolvedConfig {
    const chain = config.chain ?? "mainnet";
    const chainConfig = getChainConfig(chain);
    if (!chainConfig) throw new InvalidChainError(chain);

    return {
      chain,
      apiUrl: config.apiUrl ?? chainConfig.apiUrl,
      wsUrl: config.wsUrl ?? chainConfig.wsUrl,
      rpcUrl: config.rpcUrl ?? chainConfig.rpcUrl,
      provider: config.provider ?? null,
      denshokanAddress: config.denshokanAddress,
      registryAddress: config.registryAddress,
      primarySource: config.primarySource ?? "api",
      fetch: { ...DEFAULT_FETCH_CONFIG, ...config.fetch },
      ws: { ...DEFAULT_WS_CONFIG, ...config.ws },
    };
  }

  private get apiCtx() {
    return { baseUrl: this.config.apiUrl, fetchConfig: this.config.fetch };
  }

  private get provider(): RpcProvider {
    if (!this._provider) {
      this._provider = this.config.provider
        ? (this.config.provider as RpcProvider)
        : createProvider(this.config.rpcUrl);
    }
    return this._provider;
  }

  private get denshokanContract(): Contract {
    if (!this._denshokanContract) {
      this._denshokanContract = createContract(
        denshokanAbi as unknown[],
        this.config.denshokanAddress,
        this.provider,
      );
    }
    return this._denshokanContract;
  }

  private get registryContract(): Contract {
    if (!this._registryContract) {
      // Registry uses same ABI structure — at minimum it has game_metadata and game_address
      this._registryContract = createContract(
        denshokanAbi as unknown[],
        this.config.registryAddress,
        this.provider,
      );
    }
    return this._registryContract;
  }

  private getGameContract(gameAddress: string): Contract {
    let contract = this._gameContracts.get(gameAddress);
    if (!contract) {
      contract = createContract(denshokanAbi as unknown[], gameAddress, this.provider);
      this._gameContracts.set(gameAddress, contract);
    }
    return contract;
  }

  private async resolveGameAddress(gameId: number): Promise<string> {
    const cached = this._gameAddressCache.get(gameId);
    if (cached) return cached;
    const address = await rpcGameAddress(this.registryContract, gameId);
    this._gameAddressCache.set(gameId, address);
    return address;
  }

  private async resolveGameAddressForToken(tokenId: string): Promise<string> {
    const decoded = decodePackedTokenId(tokenId);
    return this.resolveGameAddress(decoded.gameId);
  }

  // =========================================================================
  // Games (API, with RPC fallback where noted)
  // =========================================================================

  async getGames(): Promise<Game[]> {
    return apiGetGames(this.apiCtx);
  }

  async getGame(gameId: number): Promise<Game> {
    if (this.config.primarySource === "api") {
      return withFallback(
        () => apiGetGame(this.apiCtx, gameId),
        async () => {
          const meta = await rpcGameMetadata(this.registryContract, gameId);
          return {
            id: meta.game_id,
            name: meta.name,
            description: "",
            contract_address: meta.contract_address,
            created_at: "",
          };
        },
        this.connectionStatus,
      );
    }
    const meta = await rpcGameMetadata(this.registryContract, gameId);
    return {
      id: meta.game_id,
      name: meta.name,
      description: "",
      contract_address: meta.contract_address,
      created_at: "",
    };
  }

  async getGameStats(gameId: number): Promise<GameStats> {
    return apiGetGameStats(this.apiCtx, gameId);
  }

  async getGameLeaderboard(gameId: number, opts?: LeaderboardParams): Promise<LeaderboardEntry[]> {
    return apiGetGameLeaderboard(this.apiCtx, gameId, opts);
  }

  async getLeaderboardPosition(gameId: number, tokenId: string, context?: number): Promise<LeaderboardPosition> {
    return apiGetLeaderboardPosition(this.apiCtx, gameId, tokenId, context);
  }

  async getGameObjectives(gameId: number): Promise<GameObjective[]> {
    return apiGetGameObjectives(this.apiCtx, gameId);
  }

  async getGameSettings(gameId: number): Promise<GameSetting[]> {
    return apiGetGameSettings(this.apiCtx, gameId);
  }

  // =========================================================================
  // Tokens (API, with RPC fallback where noted)
  // =========================================================================

  async getTokens(params?: TokensFilterParams): Promise<PaginatedResult<Token>> {
    return apiGetTokens(this.apiCtx, params);
  }

  async getToken(tokenId: string): Promise<Token> {
    if (this.config.primarySource === "api") {
      return withFallback(
        () => apiGetToken(this.apiCtx, tokenId),
        async () => this.buildTokenFromRpc(tokenId),
        this.connectionStatus,
      );
    }
    return this.buildTokenFromRpc(tokenId);
  }

  async getTokenScores(tokenId: string, limit?: number): Promise<TokenScoreEntry[]> {
    return apiGetTokenScores(this.apiCtx, tokenId, limit);
  }

  private async buildTokenFromRpc(tokenId: string): Promise<Token> {
    const [metadata, owner] = await Promise.all([
      rpcTokenMetadata(this.denshokanContract, tokenId),
      rpcOwnerOf(this.denshokanContract, tokenId),
    ]);
    const decoded = decodePackedTokenId(tokenId);
    return {
      token_id: tokenId,
      game_id: metadata.game_id,
      owner,
      score: 0,
      game_over: false,
      player_name: metadata.player_name,
      minted_by: metadata.minted_by,
      minted_at: decoded.mintedAt.toISOString(),
      settings_id: metadata.settings_id,
      objective_id: metadata.objective_id,
      soulbound: metadata.is_soulbound,
      is_playable: metadata.is_playable,
      game_address: metadata.game_address,
    };
  }

  // =========================================================================
  // Players (API only)
  // =========================================================================

  async getPlayerTokens(address: string, params?: PlayerTokensParams): Promise<PaginatedResult<Token>> {
    return apiGetPlayerTokens(this.apiCtx, address, params);
  }

  async getPlayerStats(address: string): Promise<PlayerStats> {
    return apiGetPlayerStats(this.apiCtx, address);
  }

  // =========================================================================
  // Minters (API only)
  // =========================================================================

  async getMinters(): Promise<Minter[]> {
    return apiGetMinters(this.apiCtx);
  }

  async getMinter(minterId: string): Promise<Minter> {
    return apiGetMinter(this.apiCtx, minterId);
  }

  // =========================================================================
  // Activity (API only)
  // =========================================================================

  async getActivity(params?: ActivityParams): Promise<ActivityEvent[]> {
    return apiGetActivity(this.apiCtx, params);
  }

  async getActivityStats(gameId?: number): Promise<ActivityStats> {
    return apiGetActivityStats(this.apiCtx, gameId);
  }

  // =========================================================================
  // RPC: Denshokan Contract (ERC721)
  // =========================================================================

  async balanceOf(account: string): Promise<bigint> {
    return rpcBalanceOf(this.denshokanContract, account);
  }

  async ownerOf(tokenId: string): Promise<string> {
    return rpcOwnerOf(this.denshokanContract, tokenId);
  }

  async tokenUri(tokenId: string): Promise<string> {
    return rpcTokenUri(this.denshokanContract, tokenId);
  }

  async name(): Promise<string> {
    return rpcName(this.denshokanContract);
  }

  async symbol(): Promise<string> {
    return rpcSymbol(this.denshokanContract);
  }

  async royaltyInfo(tokenId: string, salePrice: bigint): Promise<RoyaltyInfo> {
    return rpcRoyaltyInfo(this.denshokanContract, tokenId, salePrice);
  }

  // =========================================================================
  // RPC: Denshokan Contract (batch-first metadata)
  // =========================================================================

  async tokenMetadata(tokenId: string): Promise<TokenMetadata> {
    return rpcTokenMetadata(this.denshokanContract, tokenId);
  }

  async tokenMetadataBatch(tokenIds: string[]): Promise<TokenMetadata[]> {
    return rpcTokenMetadataBatch(this.denshokanContract, tokenIds);
  }

  async isPlayable(tokenId: string): Promise<boolean> {
    return rpcIsPlayable(this.denshokanContract, tokenId);
  }

  async isPlayableBatch(tokenIds: string[]): Promise<boolean[]> {
    return rpcIsPlayableBatch(this.denshokanContract, tokenIds);
  }

  async settingsId(tokenId: string): Promise<number> {
    return rpcSettingsId(this.denshokanContract, tokenId);
  }

  async settingsIdBatch(tokenIds: string[]): Promise<number[]> {
    return rpcSettingsIdBatch(this.denshokanContract, tokenIds);
  }

  async playerName(tokenId: string): Promise<string> {
    return rpcPlayerName(this.denshokanContract, tokenId);
  }

  async playerNameBatch(tokenIds: string[]): Promise<string[]> {
    return rpcPlayerNameBatch(this.denshokanContract, tokenIds);
  }

  async objectiveId(tokenId: string): Promise<number> {
    return rpcObjectiveId(this.denshokanContract, tokenId);
  }

  async objectiveIdBatch(tokenIds: string[]): Promise<number[]> {
    return rpcObjectiveIdBatch(this.denshokanContract, tokenIds);
  }

  async mintedBy(tokenId: string): Promise<string> {
    return rpcMintedBy(this.denshokanContract, tokenId);
  }

  async mintedByBatch(tokenIds: string[]): Promise<string[]> {
    return rpcMintedByBatch(this.denshokanContract, tokenIds);
  }

  async isSoulbound(tokenId: string): Promise<boolean> {
    return rpcIsSoulbound(this.denshokanContract, tokenId);
  }

  async isSoulboundBatch(tokenIds: string[]): Promise<boolean[]> {
    return rpcIsSoulboundBatch(this.denshokanContract, tokenIds);
  }

  async rendererAddress(tokenId: string): Promise<string> {
    return rpcRendererAddress(this.denshokanContract, tokenId);
  }

  async rendererAddressBatch(tokenIds: string[]): Promise<string[]> {
    return rpcRendererAddressBatch(this.denshokanContract, tokenIds);
  }

  async tokenGameAddress(tokenId: string): Promise<string> {
    return rpcTokenGameAddress(this.denshokanContract, tokenId);
  }

  async tokenGameAddressBatch(tokenIds: string[]): Promise<string[]> {
    return rpcTokenGameAddressBatch(this.denshokanContract, tokenIds);
  }

  // =========================================================================
  // RPC: Registry Contract
  // =========================================================================

  async gameMetadata(gameId: number): Promise<GameMetadata> {
    return rpcGameMetadata(this.registryContract, gameId);
  }

  async gameAddress(gameId: number): Promise<string> {
    return this.resolveGameAddress(gameId);
  }

  // =========================================================================
  // RPC: Game Contract (score & game state, batch-first with fallback)
  // =========================================================================

  async score(tokenId: string, gameAddress?: string): Promise<bigint> {
    const address = gameAddress ?? await this.resolveGameAddressForToken(tokenId);
    const contract = this.getGameContract(address);
    return rpcScore(contract, tokenId);
  }

  async scoreBatch(tokenIds: string[], gameAddress: string): Promise<bigint[]> {
    const contract = this.getGameContract(gameAddress);
    return rpcScoreBatch(contract, tokenIds);
  }

  async gameOver(tokenId: string, gameAddress?: string): Promise<boolean> {
    const address = gameAddress ?? await this.resolveGameAddressForToken(tokenId);
    const contract = this.getGameContract(address);
    return rpcGameOver(contract, tokenId);
  }

  async gameOverBatch(tokenIds: string[], gameAddress: string): Promise<boolean[]> {
    const contract = this.getGameContract(gameAddress);
    return rpcGameOverBatch(contract, tokenIds);
  }

  // =========================================================================
  // RPC: Game Contract (details, batch-first)
  // =========================================================================

  async tokenName(tokenId: string, gameAddress: string): Promise<string> {
    return rpcTokenName(this.getGameContract(gameAddress), tokenId);
  }

  async tokenNameBatch(tokenIds: string[], gameAddress: string): Promise<string[]> {
    return rpcTokenNameBatch(this.getGameContract(gameAddress), tokenIds);
  }

  async tokenDescription(tokenId: string, gameAddress: string): Promise<string> {
    return rpcTokenDescription(this.getGameContract(gameAddress), tokenId);
  }

  async tokenDescriptionBatch(tokenIds: string[], gameAddress: string): Promise<string[]> {
    return rpcTokenDescriptionBatch(this.getGameContract(gameAddress), tokenIds);
  }

  async gameDetails(tokenId: string, gameAddress: string): Promise<GameDetail[]> {
    return rpcGameDetails(this.getGameContract(gameAddress), tokenId);
  }

  async gameDetailsBatch(tokenIds: string[], gameAddress: string): Promise<GameDetail[][]> {
    return rpcGameDetailsBatch(this.getGameContract(gameAddress), tokenIds);
  }

  // =========================================================================
  // RPC: Game Contract (objectives, batch-first)
  // =========================================================================

  async objectiveExists(objectiveId: number, gameAddress: string): Promise<boolean> {
    return rpcObjectiveExists(this.getGameContract(gameAddress), objectiveId);
  }

  async objectiveExistsBatch(objectiveIds: number[], gameAddress: string): Promise<boolean[]> {
    return rpcObjectiveExistsBatch(this.getGameContract(gameAddress), objectiveIds);
  }

  async objectivesDetails(tokenId: string, gameAddress: string): Promise<GameObjective[]> {
    return rpcObjectivesDetails(this.getGameContract(gameAddress), tokenId);
  }

  async objectivesDetailsBatch(tokenIds: string[], gameAddress: string): Promise<GameObjective[][]> {
    return rpcObjectivesDetailsBatch(this.getGameContract(gameAddress), tokenIds);
  }

  // =========================================================================
  // RPC: Game Contract (settings, batch-first)
  // =========================================================================

  async settingsExists(settingsId: number, gameAddress: string): Promise<boolean> {
    return rpcSettingsExists(this.getGameContract(gameAddress), settingsId);
  }

  async settingsExistsBatch(settingsIds: number[], gameAddress: string): Promise<boolean[]> {
    return rpcSettingsExistsBatch(this.getGameContract(gameAddress), settingsIds);
  }

  async settingsDetails(settingsId: number, gameAddress: string): Promise<GameSettingDetails> {
    return rpcSettingsDetail(this.getGameContract(gameAddress), settingsId);
  }

  async settingsDetailsBatch(settingsIds: number[], gameAddress: string): Promise<GameSettingDetails[]> {
    return rpcSettingsDetailsBatch(this.getGameContract(gameAddress), settingsIds);
  }

  // =========================================================================
  // RPC: Write Operations (batch-first)
  // =========================================================================

  async mint(params: MintParams): Promise<string> {
    return rpcMint(this.denshokanContract, {
      game_id: params.game_id,
      settings_id: params.settings_id,
      objective_id: params.objective_id,
      player_name: params.player_name,
      soulbound: params.soulbound,
      to: params.to,
    });
  }

  async mintBatch(params: MintParams[]): Promise<string[]> {
    return rpcMintBatch(
      this.denshokanContract,
      params.map((p) => ({
        game_id: p.game_id,
        settings_id: p.settings_id,
        objective_id: p.objective_id,
        player_name: p.player_name,
        soulbound: p.soulbound,
        to: p.to,
      })),
    );
  }

  async updateGame(tokenId: string): Promise<void> {
    return rpcUpdateGame(this.denshokanContract, tokenId);
  }

  async updateGameBatch(tokenIds: string[]): Promise<void> {
    return rpcUpdateGameBatch(this.denshokanContract, tokenIds);
  }

  async updatePlayerName(tokenId: string, name: string): Promise<void> {
    return rpcUpdatePlayerName(this.denshokanContract, tokenId, name);
  }

  async updatePlayerNameBatch(updates: PlayerNameUpdate[]): Promise<void> {
    return rpcUpdatePlayerNameBatch(
      this.denshokanContract,
      updates.map((u) => ({ token_id: u.token_id, name: u.name })),
    );
  }

  // =========================================================================
  // Utilities
  // =========================================================================

  decodeTokenId(tokenId: string | bigint): DecodedTokenId {
    return decodePackedTokenId(tokenId);
  }

  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  // =========================================================================
  // WebSocket
  // =========================================================================

  subscribe(options: WSSubscribeOptions, handler: WSEventHandler): () => void {
    return this.wsManager.subscribe(options, handler);
  }

  connect(): void {
    this.wsManager.connect();
  }

  disconnect(): void {
    this.wsManager.disconnect();
    this.connectionStatus.destroy();
  }
}

export function createDenshokanClient(config: DenshokanClientConfig): DenshokanClient {
  return new DenshokanClient(config);
}
