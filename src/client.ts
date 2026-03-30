import type { Contract, RpcProvider } from "starknet";
import type {
  DenshokanClientConfig,
  ResolvedConfig,
  Game,
  GameStats,
  GameObjectiveDetails,
  GameSettingDetails,
  GameDetail,
  SettingsParams,
  ObjectivesParams,
  Token,
  TokenMetadata,
  TokenMutableState,
  TokenScoreEntry,
  PaginatedResult,
  TokensQueryParams,
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
  GameFeeInfo,
  MintParams,
  PlayerNameUpdate,
  FilterResult,
  WSSubscribeOptions,
  WSEventHandler,
} from "./types/index.js";
import { getChainConfig } from "./chains/constants.js";
import { DEFAULT_FETCH_CONFIG } from "./utils/retry.js";
import { decodePackedTokenId, decodeCoreToken } from "./utils/token-id.js";
import { toHexTokenId, normalizeAddress } from "./utils/address.js";
import { mintParamsToSnake, playerNameUpdateToSnake } from "./utils/mappers.js";
import { assignSalts } from "./utils/salt.js";
import { InvalidChainError, GameNotFoundError } from "./errors/index.js";
import { ConnectionStatus } from "./datasource/health.js";
import { withFallback } from "./datasource/resolver.js";
import { WebSocketManager } from "./ws/manager.js";

// API imports
import {
  apiGetGames,
  apiGetGame,
  apiGetGameStats,
  apiGetSettings,
  apiGetSetting,
  apiGetObjectives,
  apiGetObjective,
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
import { rpcGameMetadata, rpcGameAddress, rpcGameFeeInfo, rpcDefaultGameFeeInfo } from "./rpc/registry.js";
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
  rpcObjectivesCount,
  rpcObjectiveExists,
  rpcObjectiveExistsBatch,
  rpcCompletedObjective,
  rpcCompletedObjectiveBatch,
  rpcObjectivesDetails,
  rpcObjectivesDetailsBatch,
  rpcSettingsCount,
  rpcSettingsExists,
  rpcSettingsExistsBatch,
  rpcSettingsDetail,
  rpcSettingsDetailsBatch,
} from "./rpc/game.js";

// ABI
import denshokanAbi from "./rpc/abis/denshokan.json";
import minigameRegistryAbi from "./rpc/abis/minigameRegistry.json";
import viewerAbi from "./rpc/abis/denshokanViewer.json";
import minigameAbi from "./rpc/abis/minigame.json";

// Viewer RPC imports
import {
  viewerTokensByGameAddress,
  viewerTokensByGameAndSettings,
  viewerTokensByGameAndObjective,
  viewerTokensByGameAndPlayable,
  viewerTokensByGameAndGameOver,
  viewerTokensByGameAndSoulbound,
  viewerTokensByMinterAddress,
  viewerTokensByMinterAndGame,
  viewerTokensOfOwnerByGame,
  viewerTokensOfOwnerByGameAndPlayable,
  viewerTokensOfOwnerByGameAndSettings,
  viewerTokensOfOwnerByGameAndObjective,
  viewerTokensOfOwnerByGameAndGameOver,
  viewerTokensOfOwnerBySoulbound,
  viewerTokensOfOwnerByMinter,
  viewerTokensBySoulbound,
  viewerTokensByMintedAtRange,
  viewerTokensByPlayable,
  viewerTokensOfOwner,
  viewerTokensOfOwnerByPlayable,
  viewerTokensOfOwnerByGameOver,
  viewerTokensFullStateBatch,
  viewerDenshokanTokensBatch,
  viewerAllSettings,
  viewerAllObjectives,
} from "./rpc/viewer.js";

const DEFAULT_WS_CONFIG = {
  maxReconnectAttempts: 10,
  reconnectBaseDelay: 1000,
};

export class DenshokanClient {
  private readonly config: ResolvedConfig;
  private readonly connectionStatus: ConnectionStatus;
  private readonly wsManager: WebSocketManager;

  // In-flight request deduplication for getTokens
  private _inflight = new Map<string, Promise<PaginatedResult<Token>>>();

  // Lazy-initialized RPC objects
  private _provider: RpcProvider | null = null;
  private _denshokanContract: Contract | null = null;
  private _registryContract: Contract | null = null;
  private _viewerContract: Contract | null = null;
  private _gameContracts = new Map<string, Contract>();
  private _gameAddressCache = new Map<number, string>();
  private _gameIdByAddress = new Map<string, number>();

  constructor(config: DenshokanClientConfig) {
    this.config = this.resolveConfig(config);
    this.connectionStatus = new ConnectionStatus(this.config.apiUrl, this.config.rpcUrl, this.config.health);
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

    const apiUrl = config.apiUrl ?? chainConfig.apiUrl;
    const wsUrl = config.wsUrl ?? (config.apiUrl
      ? config.apiUrl.replace(/^http/, "ws").replace(/\/$/, "") + "/ws"
      : chainConfig.wsUrl);

    return {
      chain,
      apiUrl,
      wsUrl,
      rpcUrl: config.rpcUrl ?? chainConfig.rpcUrl,
      provider: config.provider ?? null,
      denshokanAddress: config.denshokanAddress ?? chainConfig.denshokanAddress,
      registryAddress: config.registryAddress ?? chainConfig.registryAddress,
      viewerAddress: config.viewerAddress ?? chainConfig.viewerAddress,
      primarySource: config.primarySource ?? "api",
      fetch: { ...DEFAULT_FETCH_CONFIG, ...config.fetch },
      ws: { ...DEFAULT_WS_CONFIG, ...config.ws },
      health: { initialCheckDelay: 1000, checkInterval: 30000, checkTimeout: 5000, maxBlockLag: 50, ...config.health },
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
      this._registryContract = await createContract(
        minigameRegistryAbi as unknown[],
        this.config.registryAddress,
        provider,
      );
    }
    return this._registryContract;
  }

  private async getViewerContract(): Promise<Contract> {
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
      contract = await createContract(minigameAbi as unknown[], gameAddress, provider);
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
    this._gameIdByAddress.set(normalizeAddress(address), gameId);
    return address;
  }

  private async resolveGameAddressForToken(tokenId: string): Promise<string> {
    const decoded = decodePackedTokenId(tokenId);
    return this.resolveGameAddress(decoded.gameId);
  }

  /**
   * If input looks like a numeric game ID (not a hex address), resolve it to
   * a contract address using the registry. This ensures the RPC fallback path
   * receives a proper contract address.
   */
  private async maybeResolveNumericId(input: string): Promise<string> {
    if (input.startsWith("0x")) return input;
    if (/^[0-9]+$/.test(input)) {
      const numericId = Number(input);
      if (numericId > 0 && numericId <= Number.MAX_SAFE_INTEGER) {
        return this.resolveGameAddress(numericId);
      }
    }
    return input;
  }

  /**
   * Resolve a gameAddress to a numeric gameId.
   * Uses cache first, then fetches games list from API to populate cache.
   */
  private async resolveGameId(gameAddress: string): Promise<number> {
    const normalized = normalizeAddress(gameAddress);
    const cached = this._gameIdByAddress.get(normalized);
    if (cached !== undefined) return cached;
    // Populate cache from games list
    const games = await this.getGames();
    for (const game of games.data) {
      const addr = normalizeAddress(game.contractAddress);
      this._gameIdByAddress.set(addr, game.gameId);
      this._gameAddressCache.set(game.gameId, addr);
    }
    const resolved = this._gameIdByAddress.get(normalized);
    if (resolved === undefined) throw new GameNotFoundError(gameAddress);
    return resolved;
  }

  // =========================================================================
  // Games (API, with RPC fallback where noted)
  // =========================================================================

  async getGames(params?: { limit?: number; offset?: number }): Promise<PaginatedResult<Game>> {
    return apiGetGames(this.apiCtx, params);
  }

  private async getGameViaRpc(gameAddress: string): Promise<Game> {
    const resolved = await this.maybeResolveNumericId(gameAddress);
    const gameId = await this.resolveGameId(resolved);
    const contract = await this.getRegistryContract();
    const meta = await rpcGameMetadata(contract, gameId);
    return {
      gameId: meta.gameId,
      name: meta.name,
      description: meta.description,
      contractAddress: meta.contractAddress,
      imageUrl: meta.image || undefined,
      developer: meta.developer || undefined,
      publisher: meta.publisher || undefined,
      genre: meta.genre || undefined,
      color: meta.color || undefined,
      clientUrl: meta.clientUrl || undefined,
      rendererAddress: meta.rendererAddress || undefined,
      royaltyFraction: meta.royaltyFraction.toString(),
      skillsAddress: meta.skillsAddress || undefined,
      createdAt: meta.createdAt ? new Date(meta.createdAt * 1000).toISOString() : "",
    };
  }

  async getGame(gameAddress: string): Promise<Game> {
    if (this.config.primarySource === "api") {
      return withFallback(
        () => apiGetGame(this.apiCtx, gameAddress),
        () => this.getGameViaRpc(gameAddress),
        this.connectionStatus,
      );
    }
    return this.getGameViaRpc(gameAddress);
  }

  async getGameStats(gameAddress: string): Promise<GameStats> {
    return apiGetGameStats(this.apiCtx, gameAddress);
  }

  // =========================================================================
  // Settings & Objectives (API with RPC fallback)
  // =========================================================================

  async getSettings(params?: SettingsParams): Promise<PaginatedResult<GameSettingDetails>> {
    const gameAddress = params?.gameAddress ?? "0x0";
    if (this.config.primarySource === "api") {
      return withFallback(
        () => apiGetSettings(this.apiCtx, params),
        () => this.fetchSettingsFromRpc(gameAddress, params),
        this.connectionStatus,
      );
    }
    return this.fetchSettingsFromRpc(gameAddress, params);
  }

  async getSetting(settingsId: number, gameAddress: string): Promise<GameSettingDetails> {
    if (this.config.primarySource === "api") {
      return withFallback(
        () => apiGetSetting(this.apiCtx, gameAddress, settingsId),
        async () => {
          const contract = await this.getGameContract(gameAddress);
          return rpcSettingsDetail(contract, settingsId);
        },
        this.connectionStatus,
      );
    }
    const contract = await this.getGameContract(gameAddress);
    return rpcSettingsDetail(contract, settingsId);
  }

  async getObjectives(params?: ObjectivesParams): Promise<PaginatedResult<GameObjectiveDetails>> {
    const gameAddress = params?.gameAddress ?? "0x0";
    if (this.config.primarySource === "api") {
      return withFallback(
        () => apiGetObjectives(this.apiCtx, params),
        () => this.fetchObjectivesFromRpc(gameAddress, params),
        this.connectionStatus,
      );
    }
    return this.fetchObjectivesFromRpc(gameAddress, params);
  }

  async getObjective(objectiveId: number, gameAddress: string): Promise<GameObjectiveDetails> {
    if (this.config.primarySource === "api") {
      return withFallback(
        () => apiGetObjective(this.apiCtx, gameAddress, objectiveId),
        async () => {
          const contract = await this.getGameContract(gameAddress);
          return rpcObjectivesDetails(contract, objectiveId);
        },
        this.connectionStatus,
      );
    }
    const contract = await this.getGameContract(gameAddress);
    return rpcObjectivesDetails(contract, objectiveId);
  }

  private async fetchSettingsFromRpc(
    gameAddress: string,
    params?: SettingsParams,
  ): Promise<PaginatedResult<GameSettingDetails>> {
    const viewerContract = await this.getViewerContract();
    const offset = params?.offset ?? 0;
    const limit = params?.limit ?? 50;
    return viewerAllSettings(viewerContract, gameAddress, offset, limit);
  }

  private async fetchObjectivesFromRpc(
    gameAddress: string,
    params?: ObjectivesParams,
  ): Promise<PaginatedResult<GameObjectiveDetails>> {
    const viewerContract = await this.getViewerContract();
    const offset = params?.offset ?? 0;
    const limit = params?.limit ?? 50;
    return viewerAllObjectives(viewerContract, gameAddress, offset, limit);
  }

  // =========================================================================
  // Tokens (API, with RPC fallback where noted)
  // =========================================================================

  async getTokens(params?: TokensQueryParams): Promise<PaginatedResult<Token>> {
    // Deduplicate concurrent requests with identical params — when multiple
    // useLiveLeaderboard hooks receive the same WS event, their scheduleRefetch
    // calls fire near-simultaneously. Reusing the in-flight promise avoids
    // redundant HTTP requests and rate-limit pressure.
    const { includeUri, ...filterOnly } = params ?? {};
    const cacheKey = JSON.stringify(filterOnly);
    const existing = this._inflight.get(cacheKey);
    if (existing) return existing;

    const promise = this._getTokensImpl(params).finally(() => {
      this._inflight.delete(cacheKey);
    });
    this._inflight.set(cacheKey, promise);
    return promise;
  }

  private async _getTokensImpl(params?: TokensQueryParams): Promise<PaginatedResult<Token>> {
    let result: PaginatedResult<Token>;
    if (this.config.primarySource === "api") {
      result = await withFallback(
        () => apiGetTokens(this.apiCtx, params),
        async () => this.buildTokensFromRpc(params),
        this.connectionStatus,
      );
    } else {
      result = await this.buildTokensFromRpc(params);
    }

    // Enrich with token URIs if requested — only fetch for tokens missing a URI
    if (params?.includeUri && result.data.length > 0) {
      const missingIndices = result.data
        .map((t, i) => (!t.tokenUri ? i : -1))
        .filter((i) => i >= 0);

      if (missingIndices.length > 0) {
        const missingIds = missingIndices.map((i) => result.data[i].tokenId);
        try {
          const uris = await this.tokenUriBatch(missingIds);
          result = {
            ...result,
            data: result.data.map((token, i) => {
              const missingIdx = missingIndices.indexOf(i);
              return missingIdx >= 0 && uris[missingIdx]
                ? { ...token, tokenUri: uris[missingIdx] }
                : token;
            }),
          };
        } catch {
          // URI fetch is best-effort; don't fail the whole token load
        }
      }
    }

    return result;
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
    // Use the enriched batch method with a single token — one RPC call
    const viewerContract = await this.getViewerContract();
    const tokens = await this.buildTokensFromFullStateBatch(viewerContract, [tokenId]);
    if (tokens.length > 0) return tokens[0];

    // Fallback: individual RPC calls if viewer fails
    const decoded = decodePackedTokenId(tokenId);
    const contract = await this.getDenshokanContract();
    const [mutableState, owner, playerName, isPlayable, gameAddress] = await Promise.all([
      rpcTokenMutableState(contract, tokenId),
      rpcOwnerOf(contract, tokenId),
      rpcPlayerName(contract, tokenId),
      rpcIsPlayable(contract, tokenId),
      rpcTokenGameAddress(contract, tokenId),
    ]);

    return {
      tokenId: toHexTokenId(tokenId),
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
      owner,
      score: 0,
      gameOver: mutableState.gameOver,
      playerName,
      isPlayable,
      gameAddress,
      contextId: null,
      contextData: null,
      minterAddress: null,
    };
  }

  private async buildTokensFromRpc(params?: TokensQueryParams): Promise<PaginatedResult<Token>> {
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
      includeUri,
    } = params ?? {};

    const denshokanContract = await this.getDenshokanContract();
    const viewerContract = await this.getViewerContract();

    // Resolve gameAddress from gameId if needed
    let gameAddress = providedGameAddress;
    if (!gameAddress && gameId !== undefined) {
      gameAddress = await this.resolveGameAddress(gameId);
    }

    // Use viewer contract for efficient filtering
    let filterResult: FilterResult | null = null;

    if (owner && gameAddress && settingsId !== undefined) {
      // Owner's tokens in a game with specific settings
      filterResult = await viewerTokensOfOwnerByGameAndSettings(
        viewerContract,
        owner,
        gameAddress,
        settingsId,
        offset,
        limit,
      );
    } else if (owner && gameAddress && objectiveId !== undefined) {
      // Owner's tokens in a game with specific objective
      filterResult = await viewerTokensOfOwnerByGameAndObjective(
        viewerContract,
        owner,
        gameAddress,
        objectiveId,
        offset,
        limit,
      );
    } else if (owner && gameAddress && gameOver === true) {
      // Owner's completed tokens in a game
      filterResult = await viewerTokensOfOwnerByGameAndGameOver(
        viewerContract,
        owner,
        gameAddress,
        offset,
        limit,
      );
    } else if (owner && gameAddress && playable === true) {
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
    } else if (owner && minterAddress) {
      // Owner's tokens from a specific minter
      filterResult = await viewerTokensOfOwnerByMinter(
        viewerContract,
        owner,
        minterAddress,
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
      filterResult = await viewerTokensOfOwnerByPlayable(viewerContract, owner, offset, limit);
    } else if (owner && gameOver === true) {
      // Owner's completed tokens across all games
      filterResult = await viewerTokensOfOwnerByGameOver(viewerContract, owner, offset, limit);
    } else if (owner) {
      // Owner's tokens (no other filter)
      filterResult = await viewerTokensOfOwner(viewerContract, owner, offset, limit);
    } else if (gameAddress && playable === true) {
      // Playable tokens for a game
      filterResult = await viewerTokensByGameAndPlayable(viewerContract, gameAddress, offset, limit);
    } else if (gameAddress && gameOver === true) {
      // Game over tokens for a game
      filterResult = await viewerTokensByGameAndGameOver(viewerContract, gameAddress, offset, limit);
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
    } else if (gameAddress && soulbound !== undefined) {
      // Game + Soulbound filter
      filterResult = await viewerTokensByGameAndSoulbound(
        viewerContract,
        gameAddress,
        soulbound,
        offset,
        limit,
      );
    } else if (minterAddress && gameAddress) {
      // Minter + Game filter
      filterResult = await viewerTokensByMinterAndGame(
        viewerContract,
        minterAddress,
        gameAddress,
        offset,
        limit,
      );
    } else if (gameAddress) {
      // Game-only filter
      filterResult = await viewerTokensByGameAddress(viewerContract, gameAddress, offset, limit);
    } else if (minterAddress) {
      // Minter filter
      filterResult = await viewerTokensByMinterAddress(viewerContract, minterAddress, offset, limit);
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

    let tokenIds: string[];
    let total: number;

    if (filterResult) {
      // Contract-side filtering was used
      tokenIds = filterResult.tokenIds;
      total = filterResult.total;
    } else {
      // No filter - enumerate all tokens via ERC721Enumerable
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

    // Build full Token objects for the results using batch method (1 RPC call for all tokens)
    let tokens = tokenIds.length > 0
      ? await this.buildTokensFromFullStateBatch(viewerContract, tokenIds, includeUri)
      : [];

    // Post-filter by contextId: in RPC mode contextId is not resolved, so
    // at minimum filter out tokens without context (creator tokens).
    // When the API is available it handles this server-side.
    const { contextId } = params ?? {};
    if (contextId !== undefined) {
      tokens = tokens.filter((t) =>
        t.contextId !== null ? t.contextId === contextId : t.hasContext,
      );
      total = tokens.length;
    }

    return { data: tokens, total };
  }

  private async buildTokensFromFullStateBatch(
    viewerContract: Contract,
    tokenIds: string[],
    includeUri?: boolean,
  ): Promise<Token[]> {
    const CHUNK_SIZE = 50;

    // Chunk the full state batch calls
    const chunks: string[][] = [];
    for (let i = 0; i < tokenIds.length; i += CHUNK_SIZE) {
      chunks.push(tokenIds.slice(i, i + CHUNK_SIZE));
    }
    // Try enriched denshokan_tokens_batch first, fall back to basic tokens_full_state_batch
    let stateResults;
    let usedEnriched = false;
    try {
      stateResults = await Promise.all(
        chunks.map((chunk) => viewerDenshokanTokensBatch(viewerContract, chunk)),
      );
      usedEnriched = true;
    } catch (error: unknown) {
      // Only fall back if the viewer doesn't support the method (old contract)
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("Entry point") || msg.includes("not found") || msg.includes("ENTRYPOINT_NOT_FOUND")) {
        stateResults = await Promise.all(
          chunks.map((chunk) => viewerTokensFullStateBatch(viewerContract, chunk)),
        );
      } else {
        throw error;
      }
    }
    const fullStates = stateResults.flat();

    // Optionally fetch URIs (chunked, non-fatal)
    let uris: string[] | undefined;
    if (includeUri) {
      try {
        uris = await this.tokenUriBatch(tokenIds);
      } catch {
        // URI fetch is best-effort; don't fail the whole token load
      }
    }

    const ZERO_ADDR = "0x" + "0".repeat(64);
    const nonZero = (addr: string | undefined): string | undefined =>
      addr && addr !== ZERO_ADDR ? addr : undefined;

    return fullStates.map((state, i) => {
      const decoded = decodePackedTokenId(state.tokenId);
      const enriched = usedEnriched ? (state as import("./types/rpc.js").DenshokanTokenState) : null;
      return {
        tokenId: state.tokenId,
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
        owner: state.owner,
        score: 0,
        gameOver: state.gameOver,
        playerName: state.playerName,
        isPlayable: state.isPlayable,
        gameAddress: state.gameAddress,
        contextId: null,
        contextData: null,
        minterAddress: nonZero(enriched?.minterAddress) ?? null,
        rendererAddress: nonZero(enriched?.rendererAddress),
        skillsAddress: nonZero(enriched?.skillsAddress),
        clientUrl: enriched?.clientUrl || undefined,
        ...(uris ? { tokenUri: uris[i] } : {}),
      };
    });
  }

  // =========================================================================
  // Players (API, with RPC fallback for tokens)
  // =========================================================================

  async getPlayerTokens(address: string, params?: PlayerTokensParams): Promise<PaginatedResult<Token>> {
    let result: PaginatedResult<Token>;
    if (this.config.primarySource === "api") {
      result = await withFallback(
        () => apiGetPlayerTokens(this.apiCtx, address, params),
        () =>
          this.buildTokensFromRpc({
            owner: address,
            gameId: params?.gameId,
            limit: params?.limit,
            offset: params?.offset,
            includeUri: params?.includeUri,
          }),
        this.connectionStatus,
      );
    } else {
      result = await this.buildTokensFromRpc({
        owner: address,
        gameId: params?.gameId,
        limit: params?.limit,
        offset: params?.offset,
        includeUri: params?.includeUri,
      });
    }

    // Enrich with token URIs if requested — only fetch for tokens missing a URI
    if (params?.includeUri && result.data.length > 0) {
      const missingIndices = result.data
        .map((t, i) => (!t.tokenUri ? i : -1))
        .filter((i) => i >= 0);

      if (missingIndices.length > 0) {
        const missingIds = missingIndices.map((i) => result.data[i].tokenId);
        try {
          const uris = await this.tokenUriBatch(missingIds);
          result = {
            ...result,
            data: result.data.map((token, i) => {
              const missingIdx = missingIndices.indexOf(i);
              return missingIdx >= 0 && uris[missingIdx]
                ? { ...token, tokenUri: uris[missingIdx] }
                : token;
            }),
          };
        } catch {
          // URI fetch is best-effort; don't fail the whole token load
        }
      }
    }

    return result;
  }

  async getPlayerStats(address: string): Promise<PlayerStats> {
    return apiGetPlayerStats(this.apiCtx, address);
  }

  // =========================================================================
  // Minters (API only)
  // =========================================================================

  async getMinters(params?: { limit?: number; offset?: number }): Promise<PaginatedResult<Minter>> {
    return apiGetMinters(this.apiCtx, params);
  }

  async getMinter(minterId: string): Promise<Minter> {
    return apiGetMinter(this.apiCtx, minterId);
  }

  // =========================================================================
  // Activity (API only)
  // =========================================================================

  async getActivity(params?: ActivityParams): Promise<PaginatedResult<ActivityEvent>> {
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
    if (this.config.primarySource === "api" && this.connectionStatus.mode !== "rpc-fallback") {
      try {
        const token = await apiGetToken(this.apiCtx, tokenId);
        if (token.tokenUri) return token.tokenUri;
        // URI not indexed yet — fall through to RPC without marking API unhealthy
      } catch {
        // Actual API failure — fall through to RPC
      }
    }
    const contract = await this.getDenshokanContract();
    return rpcTokenUri(contract, tokenId);
  }

  async tokenUriBatch(tokenIds: string[]): Promise<string[]> {
    if (tokenIds.length === 0) return [];

    if (this.config.primarySource === "api" && this.connectionStatus.mode !== "rpc-fallback") {
      const uriMap = new Map<string, string>();
      const missingIds: string[] = [];

      try {
        const concurrency = this.config.fetch.tokenUriConcurrency;
        if (!concurrency || concurrency >= tokenIds.length) {
          const results = await Promise.allSettled(
            tokenIds.map((id) => apiGetToken(this.apiCtx, id)),
          );
          results.forEach((result, i) => {
            if (result.status === "fulfilled" && result.value.tokenUri) {
              uriMap.set(tokenIds[i], result.value.tokenUri);
            } else {
              missingIds.push(tokenIds[i]);
            }
          });
        } else {
          for (let i = 0; i < tokenIds.length; i += concurrency) {
            const chunk = tokenIds.slice(i, i + concurrency);
            const results = await Promise.allSettled(
              chunk.map((id) => apiGetToken(this.apiCtx, id)),
            );
            results.forEach((result, j) => {
              if (result.status === "fulfilled" && result.value.tokenUri) {
                uriMap.set(tokenIds[i + j], result.value.tokenUri);
              } else {
                missingIds.push(tokenIds[i + j]);
              }
            });
          }
        }
      } catch {
        missingIds.length = 0;
        missingIds.push(...tokenIds);
      }

      if (missingIds.length > 0) {
        const rpcUris = await this._fetchTokenUrisRpc(missingIds);
        missingIds.forEach((id, i) => {
          if (rpcUris[i]) uriMap.set(id, rpcUris[i]);
        });
      }

      return tokenIds.map((id) => uriMap.get(id) ?? "");
    }

    return this._fetchTokenUrisRpc(tokenIds);
  }

  private async _fetchTokenUrisRpc(tokenIds: string[]): Promise<string[]> {
    const contract = await this.getDenshokanContract();
    const concurrency = this.config.fetch.tokenUriConcurrency;

    if (!concurrency || concurrency >= tokenIds.length) {
      const results = await Promise.allSettled(
        tokenIds.map((id) => rpcTokenUri(contract, id)),
      );
      return results.map((r) => (r.status === "fulfilled" ? r.value : ""));
    }

    // Throttled: process in chunks of `concurrency`
    const output: string[] = new Array(tokenIds.length).fill("");
    for (let i = 0; i < tokenIds.length; i += concurrency) {
      const chunk = tokenIds.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        chunk.map((id) => rpcTokenUri(contract, id)),
      );
      results.forEach((r, j) => {
        if (r.status === "fulfilled") output[i + j] = r.value;
      });
    }
    return output;
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

  async gameFeeInfo(gameId: number): Promise<GameFeeInfo> {
    const contract = await this.getRegistryContract();
    return rpcGameFeeInfo(contract, gameId);
  }

  async defaultGameFeeInfo(): Promise<GameFeeInfo> {
    const contract = await this.getRegistryContract();
    return rpcDefaultGameFeeInfo(contract);
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

  async objectivesCount(gameAddress: string): Promise<number> {
    const contract = await this.getGameContract(gameAddress);
    return rpcObjectivesCount(contract);
  }

  async objectiveExists(objectiveId: number, gameAddress: string): Promise<boolean> {
    const contract = await this.getGameContract(gameAddress);
    return rpcObjectiveExists(contract, objectiveId);
  }

  async objectiveExistsBatch(objectiveIds: number[], gameAddress: string): Promise<boolean[]> {
    const contract = await this.getGameContract(gameAddress);
    return rpcObjectiveExistsBatch(contract, objectiveIds);
  }

  async completedObjective(tokenId: string, objectiveId: number, gameAddress: string): Promise<boolean> {
    const contract = await this.getGameContract(gameAddress);
    return rpcCompletedObjective(contract, tokenId, objectiveId);
  }

  async completedObjectiveBatch(tokenIds: string[], objectiveId: number, gameAddress: string): Promise<boolean[]> {
    const contract = await this.getGameContract(gameAddress);
    return rpcCompletedObjectiveBatch(contract, tokenIds, objectiveId);
  }

  async objectivesDetails(objectiveId: number, gameAddress: string): Promise<GameObjectiveDetails> {
    const contract = await this.getGameContract(gameAddress);
    return rpcObjectivesDetails(contract, objectiveId);
  }

  async objectivesDetailsBatch(objectiveIds: number[], gameAddress: string): Promise<GameObjectiveDetails[]> {
    const contract = await this.getGameContract(gameAddress);
    return rpcObjectivesDetailsBatch(contract, objectiveIds);
  }

  // =========================================================================
  // RPC: Game Contract (settings, batch-first)
  // =========================================================================

  async settingsCount(gameAddress: string): Promise<number> {
    const contract = await this.getGameContract(gameAddress);
    return rpcSettingsCount(contract);
  }

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
      assignSalts(params).map(mintParamsToSnake),
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

  get wsConnected(): boolean {
    return this.wsManager.isConnected;
  }

  onWsConnectionChange(listener: (connected: boolean) => void): () => void {
    return this.wsManager.onConnectionChange(listener);
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
