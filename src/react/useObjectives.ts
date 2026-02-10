import { useState, useEffect, useCallback } from "react";
import type { GameObjectiveDetails, ObjectivesParams } from "../types/game.js";
import type { PaginatedResult } from "../types/token.js";
import { useDenshokanClient } from "./context.js";

export interface UseObjectivesResult {
  data: PaginatedResult<GameObjectiveDetails> | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useObjectives(params?: ObjectivesParams): UseObjectivesResult {
  const client = useDenshokanClient();
  const [data, setData] = useState<PaginatedResult<GameObjectiveDetails> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const paramsKey = JSON.stringify(params);

  const fetch = useCallback(() => {
    setIsLoading(true);
    setError(null);
    client
      .getObjectives(params)
      .then(setData)
      .catch(setError)
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, paramsKey]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}
