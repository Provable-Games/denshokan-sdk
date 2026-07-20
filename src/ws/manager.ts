import type { WSMessage, WSSubscribeOptions, WSEventHandler } from "../types/websocket.js";

interface WSConfig {
  /** Max consecutive failed reconnects before giving up. Infinity = never give
   *  up (the right default for a long-lived server worker; a browser tab that
   *  loses the server should keep retrying too). Reset to 0 on every successful
   *  open, so this only bites during a sustained outage. */
  maxReconnectAttempts: number;
  reconnectBaseDelay: number;
}

const DEFAULT_WS_CONFIG: WSConfig = {
  maxReconnectAttempts: Infinity,
  reconnectBaseDelay: 1000,
};

/** readyState OPEN — the numeric constant (1) is identical across the DOM
 *  WebSocket and the `ws` package, and referencing it avoids touching a global
 *  `WebSocket` that doesn't exist on Node < 21. */
const WS_OPEN = 1;

type MinimalWebSocket = {
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  readyState: number;
  send(data: string): void;
  close(): void;
};
type WebSocketCtor = new (url: string) => MinimalWebSocket;

// Resolve a WebSocket implementation ONCE. Browsers (and Node >= 21) expose a
// global `WebSocket`; on older Node there is none, so fall back to the `ws`
// package. The dynamic import is marked ignore so browser bundlers never try to
// include `ws` (it is never reached there — the global branch wins).
let wsCtorPromise: Promise<WebSocketCtor> | null = null;
function getWebSocketCtor(): Promise<WebSocketCtor> {
  if (!wsCtorPromise) {
    wsCtorPromise = (async (): Promise<WebSocketCtor> => {
      const g = (globalThis as { WebSocket?: WebSocketCtor }).WebSocket;
      if (g) return g;
      // A VARIABLE specifier (not a string literal) so no browser bundler statically
      // resolves `ws` — it pulls Node built-ins (net/tls) and would break a web build.
      // This branch is never reached in a browser anyway (the global wins above).
      const spec = "ws";
      const mod = await import(/* @vite-ignore */ spec);
      return ((mod as { default?: WebSocketCtor }).default ??
        (mod as unknown as WebSocketCtor));
    })();
  }
  return wsCtorPromise;
}

export class WebSocketManager {
  private ws: MinimalWebSocket | null = null;
  private wsUrl: string;
  private config: WSConfig;
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private subscriptions = new Map<string, { options: WSSubscribeOptions; handler: WSEventHandler }>();
  private nextSubId = 1;
  private connected = false;
  // Guards the async window between connect() and the socket being constructed,
  // so a second connect()/reconnect can't create a duplicate socket.
  private connecting = false;
  private connectionListeners = new Set<(connected: boolean) => void>();

  constructor(wsUrl: string, config?: Partial<WSConfig>) {
    this.wsUrl = wsUrl;
    this.config = { ...DEFAULT_WS_CONFIG, ...config };
  }

  connect(): void {
    if (this.ws || this.connecting) return;
    this.connecting = true;

    getWebSocketCtor()
      .then((WS) => {
        this.connecting = false;
        if (this.ws) return; // disconnect() ran during resolution

        this.ws = new WS(this.wsUrl);

        this.ws.onopen = () => {
          this.connected = true;
          this.reconnectAttempts = 0;
          this.notifyConnectionChange(true);
          // Re-subscribe all active subscriptions (events during the gap are the
          // caller's to reconcile — see the worker's periodic sweep).
          for (const [, sub] of this.subscriptions) {
            this.sendSubscribe(sub.options);
          }
        };

        this.ws.onmessage = (event) => {
          try {
            // `event.data` is a string (DOM) or Buffer (`ws`); JSON.parse coerces both.
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
      })
      .catch(() => {
        // WebSocket ctor couldn't be resolved/constructed (e.g. `ws` missing) —
        // retry rather than dying silently.
        this.connecting = false;
        this.ws = null;
        this.attemptReconnect();
      });
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
    this.connecting = false;
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
    if (!this.ws || this.ws.readyState !== WS_OPEN) return;
    this.ws.send(JSON.stringify({
      type: "subscribe",
      channels: options.channels,
      gameIds: options.gameIds?.map(String),
      contextIds: options.contextIds,
      minterAddresses: options.minterAddresses,
      owners: options.owners,
      settingsIds: options.settingsIds,
      objectiveIds: options.objectiveIds,
      tokenIds: options.tokenIds,
    }));
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) return;
    if (this.subscriptions.size === 0) return;
    if (this.reconnectTimeout) return; // already scheduled

    const delay = this.config.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, Math.min(delay, 30_000));
  }
}
