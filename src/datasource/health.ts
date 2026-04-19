export type ConnectionMode = "api" | "rpc-fallback" | "offline";

export interface ServiceStatus {
  available: boolean;
  lastChecked: number;
  latency: number | null;
  error: string | null;
  blockNumber?: number | null;
}

export interface ConnectionStatusState {
  api: ServiceStatus;
  rpc: ServiceStatus;
  mode: ConnectionMode;
  initialCheckComplete: boolean;
  /** Number of blocks the indexer is behind the chain head. null if unknown. */
  blockLag: number | null;
}

type StatusListener = (status: ConnectionStatusState) => void;

export interface HealthTimingConfig {
  initialCheckDelay?: number;
  checkInterval?: number;
  checkTimeout?: number;
  maxBlockLag?: number;
}

export class ConnectionStatus {
  private status: ConnectionStatusState = {
    api: { available: true, lastChecked: 0, latency: null, error: null },
    rpc: { available: true, lastChecked: 0, latency: null, error: null },
    mode: "api",
    initialCheckComplete: false,
    blockLag: null,
  };

  private listeners = new Set<StatusListener>();
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private initialCheckTimeout: ReturnType<typeof setTimeout> | null = null;
  private apiUrl: string;
  private rpcUrl: string;
  private readonly initialCheckDelay: number;
  private readonly checkIntervalMs: number;
  private readonly checkTimeoutMs: number;

  constructor(apiUrl: string, rpcUrl: string, config?: HealthTimingConfig) {
    this.apiUrl = apiUrl;
    this.rpcUrl = rpcUrl;
    this.initialCheckDelay = Math.max(config?.initialCheckDelay ?? 1_000, 100);
    this.checkIntervalMs = Math.max(config?.checkInterval ?? 30_000, 1_000);
    this.checkTimeoutMs = Math.max(config?.checkTimeout ?? 5_000, 1_000);
  }

  getStatus(): ConnectionStatusState {
    return { ...this.status };
  }

  get mode(): ConnectionMode {
    return this.status.mode;
  }

  subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => { this.listeners.delete(listener); };
  }

  startMonitoring(): void {
    if (this.checkInterval) return;
    this.initialCheckTimeout = setTimeout(() => {
      this.performHealthCheck();
      this.checkInterval = setInterval(() => this.performHealthCheck(), this.checkIntervalMs);
    }, this.initialCheckDelay);
  }

  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    if (this.initialCheckTimeout) {
      clearTimeout(this.initialCheckTimeout);
      this.initialCheckTimeout = null;
    }
  }

  markApiUnavailable(error?: string): void {
    this.updateStatus({
      api: { ...this.status.api, available: false, lastChecked: Date.now(), error: error || "Request failed" },
    });
  }

  markRpcUnavailable(error?: string): void {
    this.updateStatus({
      rpc: { ...this.status.rpc, available: false, lastChecked: Date.now(), error: error || "Request failed" },
    });
  }

  async checkNow(): Promise<void> {
    await this.performHealthCheck();
  }

  destroy(): void {
    this.stopMonitoring();
    this.listeners.clear();
  }

  private async performHealthCheck(): Promise<void> {
    const [apiResult, rpcResult] = await Promise.all([
      this.checkApi(),
      this.checkRpc(),
    ]);

    let blockLag: number | null = null;

    // Staleness check: compare indexer block vs chain head (informational only).
    // Block lag no longer triggers rpc-fallback mode because the API returns
    // correctly filtered data even when slightly behind, whereas the RPC
    // fallback cannot replicate server-side filtering (context, game_over, etc.)
    // and returns unfiltered results that are worse than stale data.
    if (
      apiResult.blockNumber != null &&
      rpcResult.blockNumber != null
    ) {
      blockLag = Math.max(0, rpcResult.blockNumber - apiResult.blockNumber);
    }

    this.updateStatus({ api: apiResult, rpc: rpcResult, blockLag, initialCheckComplete: true });
  }

  private async checkApi(): Promise<ServiceStatus> {
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.checkTimeoutMs);
      const response = await fetch(`${this.apiUrl}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;
      if (!response.ok) {
        return { available: false, lastChecked: Date.now(), latency, error: `HTTP ${response.status}`, blockNumber: null };
      }
      const data = await response.json() as { status?: string; latestBlock?: number | null };
      const isAvailable = data.status === "healthy" || data.status === "degraded" || data.status === "ok";
      return {
        available: isAvailable,
        lastChecked: Date.now(),
        latency,
        error: isAvailable ? null : `API status: ${data.status}`,
        blockNumber: data.latestBlock ?? null,
      };
    } catch (error) {
      return { available: false, lastChecked: Date.now(), latency: null, error: error instanceof Error ? error.message : "Network error", blockNumber: null };
    }
  }

  private async checkRpc(): Promise<ServiceStatus> {
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.checkTimeoutMs);
      const response = await fetch(this.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "starknet_blockNumber", params: [], id: 1 }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;
      if (!response.ok) {
        return { available: false, lastChecked: Date.now(), latency, error: `HTTP ${response.status}`, blockNumber: null };
      }
      const data = await response.json() as { result?: number; error?: unknown };
      const isHealthy = data.result !== undefined && !data.error;
      return {
        available: isHealthy,
        lastChecked: Date.now(),
        latency,
        error: isHealthy ? null : "RPC error",
        blockNumber: isHealthy ? data.result ?? null : null,
      };
    } catch (error) {
      return { available: false, lastChecked: Date.now(), latency: null, error: error instanceof Error ? error.message : "Network error", blockNumber: null };
    }
  }

  private updateStatus(partial: Partial<ConnectionStatusState>): void {
    const newStatus = { ...this.status, ...partial };

    if (newStatus.api.available) {
      newStatus.mode = "api";
    } else if (newStatus.rpc.available) {
      newStatus.mode = "rpc-fallback";
    } else {
      newStatus.mode = "offline";
    }

    const changed =
      this.status.api.available !== newStatus.api.available ||
      this.status.rpc.available !== newStatus.rpc.available ||
      this.status.mode !== newStatus.mode ||
      this.status.initialCheckComplete !== newStatus.initialCheckComplete ||
      this.status.blockLag !== newStatus.blockLag;

    this.status = newStatus;

    if (changed) {
      this.listeners.forEach((listener) => {
        try { listener(this.status); } catch { /* ignore */ }
      });
    }
  }
}
