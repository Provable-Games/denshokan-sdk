import { useState, useEffect, useCallback } from "react";
import type { PlayerStats, PlayerTokensParams } from "../types/player.js";
import type { Token, PaginatedResult } from "../types/token.js";
import { useDenshokanClient } from "./context.js";

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

export interface UsePlayerTokensResult {
  data: PaginatedResult<Token> | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function usePlayerTokens(
  address: string | undefined,
  params?: PlayerTokensParams & { includeUri?: boolean },
): UsePlayerTokensResult {
  const client = useDenshokanClient();
  const [data, setData] = useState<PaginatedResult<Token> | null>(null);
  const [isLoading, setIsLoading] = useState(!!address);
  const [error, setError] = useState<Error | null>(null);

  const paramsKey = JSON.stringify(params);

  const fetch = useCallback(() => {
    if (!address) return;
    setIsLoading(true);
    setError(null);
    client
      .getPlayerTokens(address, params)
      .then(setData)
      .catch(setError)
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, address, paramsKey]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}
