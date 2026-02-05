import { useState, useEffect, useCallback } from "react";
import type { Minter } from "../types/minter.js";
import type { PaginatedResult } from "../types/token.js";
import { useDenshokanClient } from "./context.js";

export interface MintersParams {
  limit?: number;
  offset?: number;
}

export interface UseMintersResult {
  data: PaginatedResult<Minter> | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useMinters(params?: MintersParams): UseMintersResult {
  const client = useDenshokanClient();
  const [data, setData] = useState<PaginatedResult<Minter> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const paramsKey = JSON.stringify(params);

  const fetch = useCallback(() => {
    setIsLoading(true);
    setError(null);
    client
      .getMinters(params)
      .then(setData)
      .catch(setError)
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, paramsKey]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}
