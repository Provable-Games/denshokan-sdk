import { useState, useEffect, useCallback } from "react";
import type { TokenRank, TokenRankParams } from "../types/token.js";
import { useDenshokanClient } from "./context.js";
import { useResetOnClient } from "./useResetOnClient.js";

export interface UseTokenRankOptions extends TokenRankParams {
  /** Enable/disable the hook entirely */
  enabled?: boolean;
}

export interface UseTokenRankResult {
  data: TokenRank | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useTokenRank(
  tokenId: string | undefined,
  options: UseTokenRankOptions = {},
): UseTokenRankResult {
  const { enabled = true, ...scope } = options;

  const client = useDenshokanClient();
  const [data, setData] = useState<TokenRank | null>(null);
  const [isLoading, setIsLoading] = useState(!!tokenId && enabled);
  const [error, setError] = useState<Error | null>(null);

  useResetOnClient(client, setData, setError);

  // Stable key so callers passing a new object literal don't retrigger fetches.
  const scopeKey = JSON.stringify(scope);

  const fetch = useCallback(async () => {
    if (!tokenId || !enabled) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await client.getTokenRank(tokenId, scope);
      setData(result);
    } catch (e) {
      setError(e as Error);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, tokenId, enabled, scopeKey]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}
