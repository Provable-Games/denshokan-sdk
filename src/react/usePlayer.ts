import { useState, useEffect, useCallback } from "react";
import type { PlayerStats } from "../types/player.js";
import { useDenshokanClient } from "./context.js";
import { useResetOnClient } from "./useResetOnClient.js";

export interface UsePlayerStatsResult {
  data: PlayerStats | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function usePlayerStats(address: string | undefined): UsePlayerStatsResult {
  const client = useDenshokanClient();
  const [data, setData] = useState<PlayerStats | null>(null);
  const [isLoading, setIsLoading] = useState(!!address);
  const [error, setError] = useState<Error | null>(null);

  useResetOnClient(client, setData, setError);

  const fetch = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await client.getPlayerStats(address);
      setData(result);
    } catch (e) {
      setError(e as Error);
    } finally {
      setIsLoading(false);
    }
  }, [client, address]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}
