import { useState, useEffect } from "react";
import { useDenshokanClient } from "./context.js";

export function useConnectionStatus(): { isConnected: boolean } {
  const client = useDenshokanClient();
  const [isConnected, setIsConnected] = useState(client.wsConnected);

  useEffect(() => {
    const unsubscribe = client.onWsConnectionChange((connected) => {
      setIsConnected(connected);
    });
    return unsubscribe;
  }, [client]);

  return { isConnected };
}
