import { useState, useEffect, useCallback } from "react";
import type { Game } from "../types/game.js";
import { useDenshokanClient } from "./context.js";

export interface UseGamesResult {
  data: Game[] | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useGames(): UseGamesResult {
  const client = useDenshokanClient();
  const [data, setData] = useState<Game[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(() => {
    setIsLoading(true);
    setError(null);
    client
      .getGames()
      .then(setData)
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, [client]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}
