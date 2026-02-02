import { createContext, useContext, useMemo, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { DenshokanClient, createDenshokanClient } from "../client.js";
import type { DenshokanClientConfig } from "../types/config.js";

const DenshokanContext = createContext<DenshokanClient | null>(null);

export interface DenshokanProviderProps {
  children: ReactNode;
  config?: DenshokanClientConfig;
  client?: DenshokanClient;
}

export function DenshokanProvider({ children, config, client: existingClient }: DenshokanProviderProps) {
  const client = useMemo(() => {
    if (existingClient) return existingClient;
    if (config) return createDenshokanClient(config);
    throw new Error("DenshokanProvider requires either 'config' or 'client' prop");
  }, [existingClient, config]);

  const clientRef = useRef(client);

  useEffect(() => {
    // Cleanup previous client if it changed and was created internally
    return () => {
      if (!existingClient && clientRef.current !== client) {
        clientRef.current.disconnect();
      }
    };
  }, [client, existingClient]);

  useEffect(() => {
    clientRef.current = client;
  }, [client]);

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
