import { createContext, useContext, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { DenshokanClient, createDenshokanClient } from "../client.js";
import type { DenshokanClientConfig } from "../types/config.js";
import { configsEqual } from "../utils/config-equal.js";

const DenshokanContext = createContext<DenshokanClient | null>(null);

export interface DenshokanProviderProps {
  children: ReactNode;
  config?: DenshokanClientConfig;
  client?: DenshokanClient;
}

export function DenshokanProvider({ children, config, client: existingClient }: DenshokanProviderProps) {
  // Inline `config={{ ... }}` objects are a fresh reference on every render,
  // so the internal client is keyed on the config's values, not its identity.
  // Keying on identity would discard the client on every provider-owner
  // render, making all data hooks reset and refetch in a loop (issue #38).
  const internalRef = useRef<{ config: DenshokanClientConfig; client: DenshokanClient } | null>(null);

  let client: DenshokanClient;
  if (existingClient) {
    client = existingClient;
  } else if (config) {
    if (!internalRef.current || !configsEqual(internalRef.current.config, config)) {
      internalRef.current = { config, client: createDenshokanClient(config) };
    }
    client = internalRef.current.client;
  } else {
    throw new Error("DenshokanProvider requires either 'config' or 'client' prop");
  }

  const ownsClient = !existingClient;

  useEffect(() => {
    if (!ownsClient) return;
    // The cleanup below may already have torn this client down (StrictMode
    // remounts, or a temporary switch to the `client` prop) — re-arm health
    // monitoring; WS connections are re-established by subscription hooks.
    client.getConnectionStatus().startMonitoring();
    return () => client.disconnect();
  }, [client, ownsClient]);

  return (
    <DenshokanContext.Provider value={client}>
      {children}
    </DenshokanContext.Provider>
  );
}

export function useDenshokanClient(): DenshokanClient {
  const client = useContext(DenshokanContext);
  if (!client) {
    throw new Error("useDenshokanClient must be used within a DenshokanProvider");
  }
  return client;
}
