import { useState, useEffect, useCallback } from "react";
import type { PlayerStats } from "../types/player.js";
import { useDenshokanClient } from "./context.js";
import { useResetOnClient } from "./useResetOnClient.js";

export interface UsePlayerStatsResult {
  data: PlayerStats | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function usePlayerStats(address: string | undefined): UsePlayerStatsResult {
  const client = useDenshokanClient();
  const [data, setData] = useState<PlayerStats | null>(null);
  const [isLoading, setIsLoading] = useState(!!address);
  const [error, setError] = useState<Error | null>(null);

  useResetOnClient(client, setData, setError);

  const fetch = useCallback(() => {
    if (!address) return;
    setIsLoading(true);
    setError(null);
    client
      .getPlayerStats(address)
      .then(setData)
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, [client, address]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}
