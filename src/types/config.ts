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
  denshokanAddress: string;
  registryAddress: string;
  /** Optional viewer contract address for efficient filter queries */
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
  /** Viewer contract address (optional - if not set, filters use client-side filtering) */
  viewerAddress: string | null;
  primarySource: DataSource;
  fetch: Required<FetchConfig>;
  ws: Required<WSConfig>;
}
