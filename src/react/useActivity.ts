import { useState, useEffect, useCallback } from "react";
import type { ActivityEvent, ActivityParams } from "../types/activity.js";
import type { PaginatedResult } from "../types/token.js";
import { useDenshokanClient } from "./context.js";
import { useResetOnClient } from "./useResetOnClient.js";

export interface UseActivityResult {
  data: PaginatedResult<ActivityEvent> | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useActivity(params?: ActivityParams): UseActivityResult {
  const client = useDenshokanClient();
  const [data, setData] = useState<PaginatedResult<ActivityEvent> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useResetOnClient(client, setData, setError);

  const paramsKey = JSON.stringify(params);

  const fetch = useCallback(() => {
    setIsLoading(true);
    setError(null);
    client
      .getActivity(params)
      .then(setData)
      .catch(setError)
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, paramsKey]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}
