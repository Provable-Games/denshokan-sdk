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
}
