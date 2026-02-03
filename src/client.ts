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
  TokenMutableState,
  TokenScoreEntry,
  PaginatedResult,
  TokensFilterParams,
  DecodedTokenId,
  CoreToken,
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
import { decodePackedTokenId, decodeCoreToken } from "./utils/token-id.js";
import { mintParamsToSnake, playerNameUpdateToSnake } from "./utils/mappers.js";
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
  rpcTotalSupply,
  rpcTokenByIndex,
  rpcTokenOfOwnerByIndex,
  rpcTokenMetadata,
  rpcTokenMetadataBatch,
  rpcTokenMutableState,
  rpcTokenMutableStateBatch,
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

  private async getProvider(): Promise<RpcProvider> {
    if (!this._provider) {
      this._provider = this.config.provider
        ? (this.config.provider as RpcProvider)
        : await createProvider(this.config.rpcUrl);
    }
    return this._provider;
  }

  private async getDenshokanContract(): Promise<Contract> {
    if (!this._denshokanContract) {
      const provider = await this.getProvider();
      this._denshokanContract = await createContract(
        denshokanAbi as unknown[],
        this.config.denshokanAddress,
        provider,
      );
    }
    return this._denshokanContract;
  }

  private async getRegistryContract(): Promise<Contract> {
    if (!this._registryContract) {
      const provider = await this.getProvider();
      // Registry uses same ABI structure — at minimum it has game_metadata and game_address
      this._registryContract = await createContract(
        denshokanAbi as unknown[],
        this.config.registryAddress,
        provider,
      );
    }
    return this._registryContract;
  }

  private async getGameContract(gameAddress: string): Promise<Contract> {
    let contract = this._gameContracts.get(gameAddress);
    if (!contract) {
      const provider = await this.getProvider();
      contract = await createContract(denshokanAbi as unknown[], gameAddress, provider);
      this._gameContracts.set(gameAddress, contract);
    }
    return contract;
  }

  private async resolveGameAddress(gameId: number): Promise<string> {
    const cached = this._gameAddressCache.get(gameId);
    if (cached) return cached;
    const registryContract = await this.getRegistryContract();
    const address = await rpcGameAddress(registryContract, gameId);
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
          const contract = await this.getRegistryContract();
          const meta = await rpcGameMetadata(contract, gameId);
          return {
            gameId: meta.gameId,
            name: meta.name,
            description: "",
            contractAddress: meta.contractAddress,
            createdAt: "",
          };
        },
        this.connectionStatus,
      );
    }
    const contract = await this.getRegistryContract();
    const meta = await rpcGameMetadata(contract, gameId);
    return {
      gameId: meta.gameId,
      name: meta.name,
      description: "",
      contractAddress: meta.contractAddress,
      createdAt: "",
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
    if (this.config.primarySource === "api") {
      return withFallback(
        () => apiGetTokens(this.apiCtx, params),
        async () => this.buildTokensFromRpc(params),
        this.connectionStatus,
      );
    }
    return this.buildTokensFromRpc(params);
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
    // Decode token ID first - many fields can be extracted without RPC
    const decoded = decodePackedTokenId(tokenId);
    const contract = await this.getDenshokanContract();

    // Fetch mutable state and other RPC-only fields in parallel
    const [mutableState, owner, playerName, isPlayable, gameAddress] = await Promise.all([
      rpcTokenMutableState(contract, tokenId),
      rpcOwnerOf(contract, tokenId),
      rpcPlayerName(contract, tokenId),
      rpcIsPlayable(contract, tokenId),
      rpcTokenGameAddress(contract, tokenId),
    ]);

    return {
      tokenId,
      // FROM DECODED TOKEN ID (no RPC needed for these)
      gameId: decoded.gameId,
      settingsId: decoded.settingsId,
      objectiveId: decoded.objectiveId,
      mintedAt: decoded.mintedAt.toISOString(),
      soulbound: decoded.soulbound,
      startDelay: decoded.startDelay,
      endDelay: decoded.endDelay,
      hasContext: decoded.hasContext,
      paymaster: decoded.paymaster,
      mintedBy: Number(decoded.mintedBy), // 40-bit truncated address fits in JS number
      // FROM RPC (can't derive from token ID)
      owner,
      score: 0,
      gameOver: mutableState.gameOver,
      playerName,
      isPlayable,
      gameAddress,
    };
  }

  private async buildTokensFromRpc(params?: TokensFilterParams): Promise<PaginatedResult<Token>> {
    const { gameId, owner, gameOver, limit = 100, offset = 0 } = params ?? {};
    const contract = await this.getDenshokanContract();

    // Step 1: Get all relevant token IDs
    let allTokenIds: string[];
    if (owner) {
      // Enumerate tokens for specific owner
      const balance = await rpcBalanceOf(contract, owner);
      allTokenIds = [];
      for (let i = 0n; i < balance; i++) {
        const tokenId = await rpcTokenOfOwnerByIndex(contract, owner, i);
        allTokenIds.push(tokenId);
      }
    } else {
      // Enumerate all tokens
      const totalSupply = await rpcTotalSupply(contract);
      allTokenIds = [];
      for (let i = 0n; i < totalSupply; i++) {
        const tokenId = await rpcTokenByIndex(contract, i);
        allTokenIds.push(tokenId);
      }
    }

    // Step 2: Filter by gameId (can decode from token ID, no RPC needed)
    let filteredTokenIds = allTokenIds;
    if (gameId !== undefined) {
      filteredTokenIds = filteredTokenIds.filter((tokenId) => {
        const decoded = decodePackedTokenId(tokenId);
        return decoded.gameId === gameId;
      });
    }

    // Step 3: Filter by gameOver if specified (requires mutable state lookup)
    if (gameOver !== undefined) {
      const gameOverBool = gameOver === "true";
      const mutableStates = await rpcTokenMutableStateBatch(contract, filteredTokenIds);
      filteredTokenIds = filteredTokenIds.filter((_, idx) => mutableStates[idx].gameOver === gameOverBool);
    }

    // Step 4: Apply pagination
    const total = filteredTokenIds.length;
    const paginatedTokenIds = filteredTokenIds.slice(offset, offset + limit);

    // Step 5: Build full Token objects for the paginated results
    const tokens = await Promise.all(paginatedTokenIds.map((tokenId) => this.buildTokenFromRpc(tokenId)));

    return { data: tokens, total };
  }

  // =========================================================================
  // Players (API, with RPC fallback for tokens)
  // =========================================================================

  async getPlayerTokens(address: string, params?: PlayerTokensParams): Promise<PaginatedResult<Token>> {
    if (this.config.primarySource === "api") {
      return withFallback(
        () => apiGetPlayerTokens(this.apiCtx, address, params),
        () =>
          this.buildTokensFromRpc({
            owner: address,
            gameId: params?.gameId,
            limit: params?.limit,
            offset: params?.offset,
          }),
        this.connectionStatus,
      );
    }
    return this.buildTokensFromRpc({
      owner: address,
      gameId: params?.gameId,
      limit: params?.limit,
      offset: params?.offset,
    });
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
    const contract = await this.getDenshokanContract();
    return rpcBalanceOf(contract, account);
  }

  async ownerOf(tokenId: string): Promise<string> {
    const contract = await this.getDenshokanContract();
    return rpcOwnerOf(contract, tokenId);
  }

  async tokenUri(tokenId: string): Promise<string> {
    const contract = await this.getDenshokanContract();
    return rpcTokenUri(contract, tokenId);
  }

  async name(): Promise<string> {
    const contract = await this.getDenshokanContract();
    return rpcName(contract);
  }

  async symbol(): Promise<string> {
    const contract = await this.getDenshokanContract();
    return rpcSymbol(contract);
  }

  async royaltyInfo(tokenId: string, salePrice: bigint): Promise<RoyaltyInfo> {
    const contract = await this.getDenshokanContract();
    return rpcRoyaltyInfo(contract, tokenId, salePrice);
  }

  // =========================================================================
  // RPC: Denshokan Contract (ERC721Enumerable)
  // =========================================================================

  async totalSupply(): Promise<bigint> {
    const contract = await this.getDenshokanContract();
    return rpcTotalSupply(contract);
  }

  async tokenByIndex(index: bigint): Promise<string> {
    const contract = await this.getDenshokanContract();
    return rpcTokenByIndex(contract, index);
  }

  async tokenOfOwnerByIndex(owner: string, index: bigint): Promise<string> {
    const contract = await this.getDenshokanContract();
    return rpcTokenOfOwnerByIndex(contract, owner, index);
  }

  /**
   * Enumerate all token IDs in the contract.
   * Uses ERC721Enumerable to iterate through all tokens.
   * @param options.limit - Maximum number of tokens to return (default: all)
   * @param options.offset - Starting index (default: 0)
   */
  async enumerateTokenIds(options?: { limit?: number; offset?: number }): Promise<string[]> {
    const contract = await this.getDenshokanContract();
    const total = await rpcTotalSupply(contract);
    const offset = BigInt(options?.offset ?? 0);
    const limit = options?.limit ? BigInt(options.limit) : total - offset;
    const end = offset + limit > total ? total : offset + limit;

    const tokenIds: string[] = [];
    for (let i = offset; i < end; i++) {
      const tokenId = await rpcTokenByIndex(contract, i);
      tokenIds.push(tokenId);
    }
    return tokenIds;
  }

  /**
   * Enumerate all token IDs owned by a specific address.
   * Uses ERC721Enumerable to iterate through owner's tokens.
   * @param options.limit - Maximum number of tokens to return (default: all)
   * @param options.offset - Starting index (default: 0)
   */
  async enumerateTokenIdsByOwner(
    owner: string,
    options?: { limit?: number; offset?: number },
  ): Promise<string[]> {
    const contract = await this.getDenshokanContract();
    const balance = await rpcBalanceOf(contract, owner);
    const offset = BigInt(options?.offset ?? 0);
    const limit = options?.limit ? BigInt(options.limit) : balance - offset;
    const end = offset + limit > balance ? balance : offset + limit;

    const tokenIds: string[] = [];
    for (let i = offset; i < end; i++) {
      const tokenId = await rpcTokenOfOwnerByIndex(contract, owner, i);
      tokenIds.push(tokenId);
    }
    return tokenIds;
  }

  // =========================================================================
  // RPC: Denshokan Contract (batch-first metadata)
  // =========================================================================

  async tokenMetadata(tokenId: string): Promise<TokenMetadata> {
    const contract = await this.getDenshokanContract();
    return rpcTokenMetadata(contract, tokenId);
  }

  async tokenMetadataBatch(tokenIds: string[]): Promise<TokenMetadata[]> {
    const contract = await this.getDenshokanContract();
    return rpcTokenMetadataBatch(contract, tokenIds);
  }

  async tokenMutableState(tokenId: string): Promise<TokenMutableState> {
    const contract = await this.getDenshokanContract();
    return rpcTokenMutableState(contract, tokenId);
  }

  async tokenMutableStateBatch(tokenIds: string[]): Promise<TokenMutableState[]> {
    const contract = await this.getDenshokanContract();
    return rpcTokenMutableStateBatch(contract, tokenIds);
  }

  async isPlayable(tokenId: string): Promise<boolean> {
    const contract = await this.getDenshokanContract();
    return rpcIsPlayable(contract, tokenId);
  }

  async isPlayableBatch(tokenIds: string[]): Promise<boolean[]> {
    const contract = await this.getDenshokanContract();
    return rpcIsPlayableBatch(contract, tokenIds);
  }

  async settingsId(tokenId: string): Promise<number> {
    const contract = await this.getDenshokanContract();
    return rpcSettingsId(contract, tokenId);
  }

  async settingsIdBatch(tokenIds: string[]): Promise<number[]> {
    const contract = await this.getDenshokanContract();
    return rpcSettingsIdBatch(contract, tokenIds);
  }

  async playerName(tokenId: string): Promise<string> {
    const contract = await this.getDenshokanContract();
    return rpcPlayerName(contract, tokenId);
  }

  async playerNameBatch(tokenIds: string[]): Promise<string[]> {
    const contract = await this.getDenshokanContract();
    return rpcPlayerNameBatch(contract, tokenIds);
  }

  async objectiveId(tokenId: string): Promise<number> {
    const contract = await this.getDenshokanContract();
    return rpcObjectiveId(contract, tokenId);
  }

  async objectiveIdBatch(tokenIds: string[]): Promise<number[]> {
    const contract = await this.getDenshokanContract();
    return rpcObjectiveIdBatch(contract, tokenIds);
  }

  async mintedBy(tokenId: string): Promise<string> {
    const contract = await this.getDenshokanContract();
    return rpcMintedBy(contract, tokenId);
  }

  async mintedByBatch(tokenIds: string[]): Promise<string[]> {
    const contract = await this.getDenshokanContract();
    return rpcMintedByBatch(contract, tokenIds);
  }

  async isSoulbound(tokenId: string): Promise<boolean> {
    const contract = await this.getDenshokanContract();
    return rpcIsSoulbound(contract, tokenId);
  }

  async isSoulboundBatch(tokenIds: string[]): Promise<boolean[]> {
    const contract = await this.getDenshokanContract();
    return rpcIsSoulboundBatch(contract, tokenIds);
  }

  async rendererAddress(tokenId: string): Promise<string> {
    const contract = await this.getDenshokanContract();
    return rpcRendererAddress(contract, tokenId);
  }

  async rendererAddressBatch(tokenIds: string[]): Promise<string[]> {
    const contract = await this.getDenshokanContract();
    return rpcRendererAddressBatch(contract, tokenIds);
  }

  async tokenGameAddress(tokenId: string): Promise<string> {
    const contract = await this.getDenshokanContract();
    return rpcTokenGameAddress(contract, tokenId);
  }

  async tokenGameAddressBatch(tokenIds: string[]): Promise<string[]> {
    const contract = await this.getDenshokanContract();
    return rpcTokenGameAddressBatch(contract, tokenIds);
  }

  // =========================================================================
  // RPC: Registry Contract
  // =========================================================================

  async gameMetadata(gameId: number): Promise<GameMetadata> {
    const contract = await this.getRegistryContract();
    return rpcGameMetadata(contract, gameId);
  }

  async gameAddress(gameId: number): Promise<string> {
    return this.resolveGameAddress(gameId);
  }

  // =========================================================================
  // RPC: Game Contract (score & game state, batch-first with fallback)
  // =========================================================================

  async score(tokenId: string, gameAddress?: string): Promise<bigint> {
    const address = gameAddress ?? await this.resolveGameAddressForToken(tokenId);
    const contract = await this.getGameContract(address);
    return rpcScore(contract, tokenId);
  }

  async scoreBatch(tokenIds: string[], gameAddress: string): Promise<bigint[]> {
    const contract = await this.getGameContract(gameAddress);
    return rpcScoreBatch(contract, tokenIds);
  }

  async gameOver(tokenId: string, gameAddress?: string): Promise<boolean> {
    const address = gameAddress ?? await this.resolveGameAddressForToken(tokenId);
    const contract = await this.getGameContract(address);
    return rpcGameOver(contract, tokenId);
  }

  async gameOverBatch(tokenIds: string[], gameAddress: string): Promise<boolean[]> {
    const contract = await this.getGameContract(gameAddress);
    return rpcGameOverBatch(contract, tokenIds);
  }

  // =========================================================================
  // RPC: Game Contract (details, batch-first)
  // =========================================================================

  async tokenName(tokenId: string, gameAddress: string): Promise<string> {
    const contract = await this.getGameContract(gameAddress);
    return rpcTokenName(contract, tokenId);
  }

  async tokenNameBatch(tokenIds: string[], gameAddress: string): Promise<string[]> {
    const contract = await this.getGameContract(gameAddress);
    return rpcTokenNameBatch(contract, tokenIds);
  }

  async tokenDescription(tokenId: string, gameAddress: string): Promise<string> {
    const contract = await this.getGameContract(gameAddress);
    return rpcTokenDescription(contract, tokenId);
  }

  async tokenDescriptionBatch(tokenIds: string[], gameAddress: string): Promise<string[]> {
    const contract = await this.getGameContract(gameAddress);
    return rpcTokenDescriptionBatch(contract, tokenIds);
  }

  async gameDetails(tokenId: string, gameAddress: string): Promise<GameDetail[]> {
    const contract = await this.getGameContract(gameAddress);
    return rpcGameDetails(contract, tokenId);
  }

  async gameDetailsBatch(tokenIds: string[], gameAddress: string): Promise<GameDetail[][]> {
    const contract = await this.getGameContract(gameAddress);
    return rpcGameDetailsBatch(contract, tokenIds);
  }

  // =========================================================================
  // RPC: Game Contract (objectives, batch-first)
  // =========================================================================

  async objectiveExists(objectiveId: number, gameAddress: string): Promise<boolean> {
    const contract = await this.getGameContract(gameAddress);
    return rpcObjectiveExists(contract, objectiveId);
  }

  async objectiveExistsBatch(objectiveIds: number[], gameAddress: string): Promise<boolean[]> {
    const contract = await this.getGameContract(gameAddress);
    return rpcObjectiveExistsBatch(contract, objectiveIds);
  }

  async objectivesDetails(tokenId: string, gameAddress: string): Promise<GameObjective[]> {
    const contract = await this.getGameContract(gameAddress);
    return rpcObjectivesDetails(contract, tokenId);
  }

  async objectivesDetailsBatch(tokenIds: string[], gameAddress: string): Promise<GameObjective[][]> {
    const contract = await this.getGameContract(gameAddress);
    return rpcObjectivesDetailsBatch(contract, tokenIds);
  }

  // =========================================================================
  // RPC: Game Contract (settings, batch-first)
  // =========================================================================

  async settingsExists(settingsId: number, gameAddress: string): Promise<boolean> {
    const contract = await this.getGameContract(gameAddress);
    return rpcSettingsExists(contract, settingsId);
  }

  async settingsExistsBatch(settingsIds: number[], gameAddress: string): Promise<boolean[]> {
    const contract = await this.getGameContract(gameAddress);
    return rpcSettingsExistsBatch(contract, settingsIds);
  }

  async settingsDetails(settingsId: number, gameAddress: string): Promise<GameSettingDetails> {
    const contract = await this.getGameContract(gameAddress);
    return rpcSettingsDetail(contract, settingsId);
  }

  async settingsDetailsBatch(settingsIds: number[], gameAddress: string): Promise<GameSettingDetails[]> {
    const contract = await this.getGameContract(gameAddress);
    return rpcSettingsDetailsBatch(contract, settingsIds);
  }

  // =========================================================================
  // RPC: Write Operations (batch-first)
  // =========================================================================

  async mint(params: MintParams): Promise<string> {
    const contract = await this.getDenshokanContract();
    return rpcMint(contract, mintParamsToSnake(params));
  }

  async mintBatch(params: MintParams[]): Promise<string[]> {
    const contract = await this.getDenshokanContract();
    return rpcMintBatch(
      contract,
      params.map(mintParamsToSnake),
    );
  }

  async updateGame(tokenId: string): Promise<void> {
    const contract = await this.getDenshokanContract();
    return rpcUpdateGame(contract, tokenId);
  }

  async updateGameBatch(tokenIds: string[]): Promise<void> {
    const contract = await this.getDenshokanContract();
    return rpcUpdateGameBatch(contract, tokenIds);
  }

  async updatePlayerName(tokenId: string, name: string): Promise<void> {
    const contract = await this.getDenshokanContract();
    return rpcUpdatePlayerName(contract, tokenId, name);
  }

  async updatePlayerNameBatch(updates: PlayerNameUpdate[]): Promise<void> {
    const contract = await this.getDenshokanContract();
    return rpcUpdatePlayerNameBatch(
      contract,
      updates.map(playerNameUpdateToSnake),
    );
  }

  // =========================================================================
  // Utilities
  // =========================================================================

  decodeTokenId(tokenId: string | bigint): DecodedTokenId {
    return decodePackedTokenId(tokenId);
  }

  /**
   * Decode a token ID into a CoreToken.
   * Pure function - no RPC calls. Useful for quick client-side display.
   */
  decodeToken(tokenId: string | bigint): CoreToken {
    return decodeCoreToken(tokenId);
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
