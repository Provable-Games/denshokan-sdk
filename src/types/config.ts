export type DataSource = "api" | "rpc";

export interface FetchConfig {
  timeout?: number;
  maxRetries?: number;
  baseBackoff?: number;
  maxBackoff?: number;
}

export interface WSConfig {
  maxReconnectAttempts?: number;
  reconnectBaseDelay?: number;
}

export interface HealthConfig {
  /** Delay before first health check in ms (default: 1000) */
  initialCheckDelay?: number;
  /** Interval between health checks in ms (default: 30000) */
  checkInterval?: number;
  /** Timeout for each health check in ms (default: 5000) */
  checkTimeout?: number;
}

export interface DenshokanClientConfig {
  chain?: "mainnet" | "sepolia";
  apiUrl?: string;
  wsUrl?: string;
  rpcUrl?: string;
  provider?: unknown;
  /** Denshokan ERC721 contract address. Defaults to chain-specific address if not provided. */
  denshokanAddress?: string;
  /** Minigame registry contract address. Defaults to chain-specific address if not provided. */
  registryAddress?: string;
  /** Viewer contract address for efficient filter queries. Defaults to chain-specific address if not provided. */
  viewerAddress?: string;
  primarySource?: DataSource;
  fetch?: FetchConfig;
  ws?: WSConfig;
  health?: HealthConfig;
}

export interface ResolvedConfig {
  chain: "mainnet" | "sepolia";
  apiUrl: string;
  wsUrl: string;
  rpcUrl: string;
  provider: unknown | null;
  denshokanAddress: string;
  registryAddress: string;
  /** Viewer contract address for efficient filter queries */
  viewerAddress: string;
  primarySource: DataSource;
  fetch: Required<FetchConfig>;
  ws: Required<WSConfig>;
  health: Required<HealthConfig>;
}
