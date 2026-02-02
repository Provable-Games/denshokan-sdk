// Client
export { DenshokanClient, createDenshokanClient } from "./client.js";

// Types
export type {
  DataSource,
  FetchConfig,
  WSConfig,
  DenshokanClientConfig,
  ResolvedConfig,
  Token,
  DecodedTokenId,
  TokenMetadata,
  TokenScoreEntry,
  PaginatedResult,
  TokensFilterParams,
  Game,
  GameStats,
  LeaderboardEntry,
  LeaderboardPosition,
  LeaderboardParams,
  GameDetail,
  GameObjective,
  GameSettingDetails,
  GameSetting,
  PlayerStats,
  PlayerTokensParams,
  Minter,
  ActivityEvent,
  ActivityParams,
  ActivityStats,
  WSChannel,
  WSMessage,
  WSSubscribeOptions,
  WSEventHandler,
  RoyaltyInfo,
  GameMetadata,
  MintParams,
  PlayerNameUpdate,
} from "./types/index.js";

// Errors
export {
  DenshokanError,
  ApiError,
  RpcError,
  RateLimitError,
  TimeoutError,
  AbortError,
  TokenNotFoundError,
  GameNotFoundError,
  InvalidChainError,
  DataSourceError,
} from "./errors/index.js";

// Utils
export { decodePackedTokenId } from "./utils/token-id.js";
export { normalizeAddress } from "./utils/address.js";

// Datasource
export { ConnectionStatus } from "./datasource/health.js";
export type { ConnectionMode, ServiceStatus, ConnectionStatusState } from "./datasource/health.js";
