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
  FilterResult,
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
  // Filter queries
  rpcTokensByGameAddress,
  rpcTokensByGameAndSettings,
  rpcTokensByGameAndObjective,
  rpcTokensByMinterAddress,
  rpcTokensOfOwnerByGame,
  rpcTokensBySoulbound,
  rpcTokensByMintedAtRange,
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
import viewerAbi from "./rpc/abis/denshokanViewer.json";

// Viewer RPC imports
import {
  viewerTokensByGameAddress,
  viewerTokensByGameAndSettings,
  viewerTokensByGameAndObjective,
  viewerTokensByGameAndPlayable,
  viewerTokensByGameAndGameOver,
  viewerTokensByMinterAddress,
  viewerTokensOfOwnerByGame,
  viewerTokensOfOwnerByGameAndPlayable,
  viewerTokensOfOwnerBySoulbound,
  viewerTokensBySoulbound,
  viewerTokensByMintedAtRange,
  viewerTokensByPlayable,
  viewerTokensOfOwner,
  viewerTokensOfOwnerByPlayable,
  viewerTokensOfOwnerByGameOver,
  viewerTokensFullStateBatch,
} from "./rpc/viewer.js";

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
  private _viewerContract: Contract | null = null;
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
      viewerAddress: config.viewerAddress ?? null,
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

  private async getViewerContract(): Promise<Contract | null> {
    if (!this.config.viewerAddress) return null;
    if (!this._viewerContract) {
      const provider = await this.getProvider();
      this._viewerContract = await createContract(
        viewerAbi as unknown[],
        this.config.viewerAddress,
        provider,
      );
    }
    return this._viewerContract;
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
    const {
      gameId,
      gameAddress: providedGameAddress,
      owner,
      settingsId,
      objectiveId,
      minterAddress,
      soulbound,
      playable,
      gameOver,
      mintedAfter,
      mintedBefore,
      limit = 100,
      offset = 0,
    } = params ?? {};

    const denshokanContract = await this.getDenshokanContract();
    const viewerContract = await this.getViewerContract();

    // Resolve gameAddress from gameId if needed
    let gameAddress = providedGameAddress;
    if (!gameAddress && gameId !== undefined) {
      gameAddress = await this.resolveGameAddress(gameId);
    }

    // Use viewer contract for efficient filtering when available
    let filterResult: FilterResult | null = null;

    if (viewerContract) {
      // Viewer contract available - use optimized filter queries
      if (owner && gameAddress && playable === true) {
        // Owner's playable tokens in a game
        filterResult = await viewerTokensOfOwnerByGameAndPlayable(
          viewerContract,
          owner,
          gameAddress,
          offset,
          limit,
        );
      } else if (owner && gameAddress) {
        // Owner's tokens in a game
        filterResult = await viewerTokensOfOwnerByGame(
          viewerContract,
          owner,
          gameAddress,
          offset,
          limit,
        );
      } else if (owner && soulbound !== undefined) {
        // Owner's soulbound/transferable tokens
        filterResult = await viewerTokensOfOwnerBySoulbound(
          viewerContract,
          owner,
          soulbound,
          offset,
          limit,
        );
      } else if (owner && playable === true) {
        // Owner's playable tokens across all games
        filterResult = await viewerTokensOfOwnerByPlayable(
          viewerContract,
          owner,
          offset,
          limit,
        );
      } else if (owner && gameOver === true) {
        // Owner's completed tokens across all games
        filterResult = await viewerTokensOfOwnerByGameOver(
          viewerContract,
          owner,
          offset,
          limit,
        );
      } else if (owner) {
        // Owner's tokens (no other filter)
        filterResult = await viewerTokensOfOwner(viewerContract, owner, offset, limit);
      } else if (gameAddress && playable === true) {
        // Playable tokens for a game
        filterResult = await viewerTokensByGameAndPlayable(
          viewerContract,
          gameAddress,
          offset,
          limit,
        );
      } else if (gameAddress && gameOver === true) {
        // Game over tokens for a game
        filterResult = await viewerTokensByGameAndGameOver(
          viewerContract,
          gameAddress,
          offset,
          limit,
        );
      } else if (gameAddress && settingsId !== undefined) {
        // Game + Settings filter
        filterResult = await viewerTokensByGameAndSettings(
          viewerContract,
          gameAddress,
          settingsId,
          offset,
          limit,
        );
      } else if (gameAddress && objectiveId !== undefined) {
        // Game + Objective filter
        filterResult = await viewerTokensByGameAndObjective(
          viewerContract,
          gameAddress,
          objectiveId,
          offset,
          limit,
        );
      } else if (gameAddress) {
        // Game-only filter
        filterResult = await viewerTokensByGameAddress(viewerContract, gameAddress, offset, limit);
      } else if (minterAddress) {
        // Minter filter
        filterResult = await viewerTokensByMinterAddress(
          viewerContract,
          minterAddress,
          offset,
          limit,
        );
      } else if (playable === true) {
        // Global playable tokens
        filterResult = await viewerTokensByPlayable(viewerContract, offset, limit);
      } else if (soulbound !== undefined) {
        // Soulbound filter
        filterResult = await viewerTokensBySoulbound(viewerContract, soulbound, offset, limit);
      } else if (mintedAfter !== undefined || mintedBefore !== undefined) {
        // Time range filter
        const startTime = mintedAfter ?? 0;
        const endTime = mintedBefore ?? Math.floor(Date.now() / 1000) + 86400 * 365 * 100;
        filterResult = await viewerTokensByMintedAtRange(
          viewerContract,
          startTime,
          endTime,
          offset,
          limit,
        );
      }
    } else {
      // No viewer - use denshokan contract filters (limited)
      if (owner && gameAddress) {
        filterResult = await rpcTokensOfOwnerByGame(
          denshokanContract,
          owner,
          gameAddress,
          offset,
          limit,
        );
      } else if (gameAddress && settingsId !== undefined) {
        filterResult = await rpcTokensByGameAndSettings(
          denshokanContract,
          gameAddress,
          settingsId,
          offset,
          limit,
        );
      } else if (gameAddress && objectiveId !== undefined) {
        filterResult = await rpcTokensByGameAndObjective(
          denshokanContract,
          gameAddress,
          objectiveId,
          offset,
          limit,
        );
      } else if (gameAddress) {
        filterResult = await rpcTokensByGameAddress(denshokanContract, gameAddress, offset, limit);
      } else if (minterAddress) {
        filterResult = await rpcTokensByMinterAddress(
          denshokanContract,
          minterAddress,
          offset,
          limit,
        );
      } else if (soulbound !== undefined) {
        filterResult = await rpcTokensBySoulbound(denshokanContract, soulbound, offset, limit);
      } else if (mintedAfter !== undefined || mintedBefore !== undefined) {
        const startTime = mintedAfter ?? 0;
        const endTime = mintedBefore ?? Math.floor(Date.now() / 1000) + 86400 * 365 * 100;
        filterResult = await rpcTokensByMintedAtRange(
          denshokanContract,
          startTime,
          endTime,
          offset,
          limit,
        );
      }
    }

    let tokenIds: string[];
    let total: number;

    if (filterResult) {
      // Contract-side filtering was used
      tokenIds = filterResult.tokenIds;
      total = filterResult.total;
    } else if (owner) {
      // Owner-only filter (enumerate owner's tokens)
      const balance = await rpcBalanceOf(denshokanContract, owner);
      const allOwnerTokenIds: string[] = [];
      for (let i = 0n; i < balance; i++) {
        const tokenId = await rpcTokenOfOwnerByIndex(denshokanContract, owner, i);
        allOwnerTokenIds.push(tokenId);
      }
      total = allOwnerTokenIds.length;
      tokenIds = allOwnerTokenIds.slice(offset, offset + limit);
    } else {
      // No filter - enumerate all tokens
      const totalSupply = await rpcTotalSupply(denshokanContract);
      total = Number(totalSupply);
      const allTokenIds: string[] = [];
      const start = BigInt(offset);
      const end = start + BigInt(limit) > totalSupply ? totalSupply : start + BigInt(limit);
      for (let i = start; i < end; i++) {
        const tokenId = await rpcTokenByIndex(denshokanContract, i);
        allTokenIds.push(tokenId);
      }
      tokenIds = allTokenIds;
    }

    // Client-side filtering for playable/gameOver when viewer not available
    if (!viewerContract && tokenIds.length > 0 && (playable !== undefined || gameOver !== undefined)) {
      const mutableStates = await rpcTokenMutableStateBatch(denshokanContract, tokenIds);
      tokenIds = tokenIds.filter((_, idx) => {
        const state = mutableStates[idx];
        if (playable !== undefined && state.gameOver === playable) return false; // playable means NOT game over
        if (gameOver !== undefined && state.gameOver !== gameOver) return false;
        return true;
      });
      // Note: total count may be inaccurate after client-side filtering
    }

    // Build full Token objects for the results
    let tokens: Token[];
    if (viewerContract && tokenIds.length > 0) {
      // Use batch method for efficiency (1 RPC call for all tokens)
      tokens = await this.buildTokensFromFullStateBatch(viewerContract, tokenIds);
    } else {
      // Fallback to individual calls
      tokens = await Promise.all(tokenIds.map((tokenId) => this.buildTokenFromRpc(tokenId)));
    }

    return { data: tokens, total };
  }

  private async buildTokensFromFullStateBatch(
    viewerContract: Contract,
    tokenIds: string[],
  ): Promise<Token[]> {
    const fullStates = await viewerTokensFullStateBatch(viewerContract, tokenIds);
    return fullStates.map((state) => {
      const decoded = decodePackedTokenId(state.tokenId);
      return {
        tokenId: state.tokenId,
        // FROM DECODED TOKEN ID (no RPC needed)
        gameId: decoded.gameId,
        settingsId: decoded.settingsId,
        objectiveId: decoded.objectiveId,
        mintedAt: decoded.mintedAt.toISOString(),
        soulbound: decoded.soulbound,
        startDelay: decoded.startDelay,
        endDelay: decoded.endDelay,
        hasContext: decoded.hasContext,
        paymaster: decoded.paymaster,
        mintedBy: Number(decoded.mintedBy),
        // FROM FULL STATE BATCH (single RPC call)
        owner: state.owner,
        score: 0,
        gameOver: state.gameOver,
        playerName: state.playerName,
        isPlayable: state.isPlayable,
        gameAddress: state.gameAddress,
      };
    });
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
