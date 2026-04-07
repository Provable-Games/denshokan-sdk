import { useState, useEffect, useCallback } from "react";
import type { TokenMetadata } from "../types/token.js";
import type { DenshokanClient } from "../client.js";
import { useDenshokanClient } from "./context.js";
import { useResetOnClient } from "./useResetOnClient.js";

interface UseAsyncResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

function useAsync<T>(
  client: DenshokanClient,
  fetcher: () => Promise<T>,
  deps: unknown[],
  enabled = true,
): UseAsyncResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);

  useResetOnClient(client, setData, setError);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetch = useCallback(fetcher, deps);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetch();
      setData(result);
    } catch (e) {
      setError(e as Error);
    } finally {
      setIsLoading(false);
    }
  }, [fetch, enabled]);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, isLoading, error, refetch };
}

export function useBalanceOf(account: string | undefined): UseAsyncResult<bigint> {
  const client = useDenshokanClient();
  return useAsync(
    client,
    () => client.balanceOf(account!),
    [client, account],
    !!account,
  );
}

export function useOwnerOf(tokenId: string | undefined): UseAsyncResult<string> {
  const client = useDenshokanClient();
  return useAsync(
    client,
    () => client.ownerOf(tokenId!),
    [client, tokenId],
    !!tokenId,
  );
}

export function useTokenUri(tokenId: string | undefined): UseAsyncResult<string> {
  const client = useDenshokanClient();
  return useAsync(
    client,
    () => client.tokenUri(tokenId!),
    [client, tokenId],
    !!tokenId,
  );
}

export function useTokenUriBatch(
  tokenIds: string[] | undefined,
): UseAsyncResult<string[]> {
  const client = useDenshokanClient();
  const key = JSON.stringify(tokenIds);
  return useAsync(
    client,
    () => client.tokenUriBatch(tokenIds!),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, key],
    !!tokenIds && tokenIds.length > 0,
  );
}

export function useTokenMetadataBatch(
  tokenIds: string[] | undefined,
): UseAsyncResult<TokenMetadata[]> {
  const client = useDenshokanClient();
  const key = JSON.stringify(tokenIds);
  return useAsync(
    client,
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
    client,
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
    client,
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
    client,
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
    client,
    () => client.settingsCount(gameAddress!),
    [client, gameAddress],
    !!gameAddress,
  );
}
