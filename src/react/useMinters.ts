import { useState, useEffect, useCallback } from "react";
import type { Minter } from "../types/minter.js";
import { useDenshokanClient } from "./context.js";

export interface UseMINTERSResult {
  data: Minter[] | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useMinters(): UseMINTERSResult {
  const client = useDenshokanClient();
  const [data, setData] = useState<Minter[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(() => {
    setIsLoading(true);
    setError(null);
    client
      .getMinters()
      .then(setData)
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, [client]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}
