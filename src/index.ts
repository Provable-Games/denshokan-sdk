// Client
export { DenshokanClient, createDenshokanClient } from "./client.js";

// Types
export type {
  DataSource,
  FetchConfig,
  WSConfig,
  HealthConfig,
  DenshokanClientConfig,
  ResolvedConfig,
  Token,
  DecodedTokenId,
  CoreToken,
  TokenMutableState,
  TokenMetadata,
  TokenScoreEntry,
  PaginatedResult,
  TokensFilterParams,
  TokensQueryParams,
  Game,
  GameStats,
  GameDetail,
  GameSettingDetails,
  GameObjectiveDetails,
  SettingsParams,
  ObjectivesParams,
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
  ScoreEvent,
  GameOverEvent,
  MintEvent,
  TokenUpdateEvent,
  NewGameEvent,
  NewMinterEvent,
  NewSettingEvent,
  NewObjectiveEvent,
  WSChannelPayloadMap,
  RoyaltyInfo,
  GameMetadata,
  GameFeeInfo,
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
export { decodePackedTokenId, decodeCoreToken } from "./utils/token-id.js";
export { normalizeAddress, toHexTokenId } from "./utils/address.js";
export { MintSaltCounter, assignSalts, MAX_SALT } from "./utils/salt.js";

// Datasource
export { ConnectionStatus } from "./datasource/health.js";
export type { ConnectionMode, ServiceStatus, ConnectionStatusState } from "./datasource/health.js";
