import { useState, useEffect, useCallback } from "react";
import type { TokenMetadata } from "../types/token.js";
import { useDenshokanClient } from "./context.js";

interface UseAsyncResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

function useAsync<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
  enabled = true,
): UseAsyncResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetch = useCallback(fetcher, deps);

  const refetch = useCallback(() => {
    if (!enabled) return;
    setIsLoading(true);
    setError(null);
    fetch()
      .then(setData)
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, [fetch, enabled]);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, isLoading, error, refetch };
}

export function useBalanceOf(account: string | undefined): UseAsyncResult<bigint> {
  const client = useDenshokanClient();
  return useAsync(
    () => client.balanceOf(account!),
    [client, account],
    !!account,
  );
}

export function useOwnerOf(tokenId: string | undefined): UseAsyncResult<string> {
  const client = useDenshokanClient();
  return useAsync(
    () => client.ownerOf(tokenId!),
    [client, tokenId],
    !!tokenId,
  );
}

export function useTokenUri(tokenId: string | undefined): UseAsyncResult<string> {
  const client = useDenshokanClient();
  return useAsync(
    () => client.tokenUri(tokenId!),
    [client, tokenId],
    !!tokenId,
  );
}

export function useTokenMetadataBatch(
  tokenIds: string[] | undefined,
): UseAsyncResult<TokenMetadata[]> {
  const client = useDenshokanClient();
  const key = JSON.stringify(tokenIds);
  return useAsync(
    () => client.tokenMetadataBatch(tokenIds!),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, key],
    !!tokenIds && tokenIds.length > 0,
  );
}

export function useScoreBatch(
  tokenIds: string[] | undefined,
  gameAddress: string | undefined,
): UseAsyncResult<bigint[]> {
  const client = useDenshokanClient();
  const key = JSON.stringify(tokenIds);
  return useAsync(
    () => client.scoreBatch(tokenIds!, gameAddress!),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, key, gameAddress],
    !!tokenIds && tokenIds.length > 0 && !!gameAddress,
  );
}

export function useGameOverBatch(
  tokenIds: string[] | undefined,
  gameAddress: string | undefined,
): UseAsyncResult<boolean[]> {
  const client = useDenshokanClient();
  const key = JSON.stringify(tokenIds);
  return useAsync(
    () => client.gameOverBatch(tokenIds!, gameAddress!),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, key, gameAddress],
    !!tokenIds && tokenIds.length > 0 && !!gameAddress,
  );
}

// === Objectives (RPC count) ===

export function useObjectivesCount(
  gameAddress: string | undefined,
): UseAsyncResult<number> {
  const client = useDenshokanClient();
  return useAsync(
    () => client.objectivesCount(gameAddress!),
    [client, gameAddress],
    !!gameAddress,
  );
}

// === Settings (RPC count) ===

export function useSettingsCount(
  gameAddress: string | undefined,
): UseAsyncResult<number> {
  const client = useDenshokanClient();
  return useAsync(
    () => client.settingsCount(gameAddress!),
    [client, gameAddress],
    !!gameAddress,
  );
}
