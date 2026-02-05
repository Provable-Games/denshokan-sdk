import { useState, useEffect, useCallback } from "react";
import type { LeaderboardEntry, LeaderboardParams } from "../types/game.js";
import type { PaginatedResult } from "../types/token.js";
import { useDenshokanClient } from "./context.js";

export interface UseLeaderboardResult {
  data: PaginatedResult<LeaderboardEntry> | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useLeaderboard(
  gameId: number | undefined,
  opts?: LeaderboardParams,
): UseLeaderboardResult {
  const client = useDenshokanClient();
  const [data, setData] = useState<PaginatedResult<LeaderboardEntry> | null>(null);
  const [isLoading, setIsLoading] = useState(!!gameId);
  const [error, setError] = useState<Error | null>(null);

  const optsKey = JSON.stringify(opts);

  const fetch = useCallback(() => {
    if (gameId === undefined) return;
    setIsLoading(true);
    setError(null);
    client
      .getGameLeaderboard(gameId, opts)
      .then(setData)
      .catch(setError)
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, gameId, optsKey]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}
