import type { WSMessage, WSSubscribeOptions, WSEventHandler } from "../types/websocket.js";

interface WSConfig {
  maxReconnectAttempts: number;
  reconnectBaseDelay: number;
}

const DEFAULT_WS_CONFIG: WSConfig = {
  maxReconnectAttempts: 10,
  reconnectBaseDelay: 1000,
};

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private wsUrl: string;
  private config: WSConfig;
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private subscriptions = new Map<string, { options: WSSubscribeOptions; handler: WSEventHandler }>();
  private nextSubId = 1;
  private connected = false;
  private connectionListeners = new Set<(connected: boolean) => void>();

  constructor(wsUrl: string, config?: Partial<WSConfig>) {
    this.wsUrl = wsUrl;
    this.config = { ...DEFAULT_WS_CONFIG, ...config };
  }

  connect(): void {
    if (this.ws) return;

    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        this.notifyConnectionChange(true);
        // Re-subscribe all active subscriptions
        for (const [, sub] of this.subscriptions) {
          this.sendSubscribe(sub.options);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string) as WSMessage;
          for (const [, sub] of this.subscriptions) {
            sub.handler(message);
          }
        } catch {
          // Ignore malformed messages
        }
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.notifyConnectionChange(false);
        this.ws = null;
        this.attemptReconnect();
      };

      this.ws.onerror = () => {
        // onclose will fire after onerror
      };
    } catch {
      this.attemptReconnect();
    }
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.notifyConnectionChange(false);
    this.reconnectAttempts = 0;
  }

  subscribe(options: WSSubscribeOptions, handler: WSEventHandler): () => void {
    const id = String(this.nextSubId++);
    this.subscriptions.set(id, { options, handler });

    if (this.connected) {
      this.sendSubscribe(options);
    }

    return () => {
      this.subscriptions.delete(id);

      // Only unsubscribe channels that no remaining subscription uses
      if (this.connected && this.ws) {
        const stillNeeded = new Set<string>();
        for (const [, sub] of this.subscriptions) {
          for (const ch of sub.options.channels) {
            stillNeeded.add(ch);
          }
        }

        const toRemove = options.channels.filter((ch) => !stillNeeded.has(ch));
        if (toRemove.length > 0) {
          this.ws.send(JSON.stringify({
            type: "unsubscribe",
            channels: toRemove,
          }));
        }
      }
    };
  }

  get isConnected(): boolean {
    return this.connected;
  }

  onConnectionChange(listener: (connected: boolean) => void): () => void {
    this.connectionListeners.add(listener);
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  private notifyConnectionChange(connected: boolean): void {
    for (const listener of this.connectionListeners) {
      try {
        listener(connected);
      } catch {
        // Ignore listener errors
      }
    }
  }

  private sendSubscribe(options: WSSubscribeOptions): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      type: "subscribe",
      channels: options.channels,
      gameIds: options.gameIds?.map(String),
      contextIds: options.contextIds,
      minterAddresses: options.minterAddresses,
      owners: options.owners,
      settingsIds: options.settingsIds,
      objectiveIds: options.objectiveIds,
    }));
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) return;
    if (this.subscriptions.size === 0) return;

    const delay = this.config.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, Math.min(delay, 30_000));
  }
}
