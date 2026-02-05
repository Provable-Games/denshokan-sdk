import { useState, useEffect, useCallback } from "react";
import type { TokenMetadata, PaginatedResult } from "../types/token.js";
import type { GameObjectiveDetails, GameSettingDetails, DetailsParams } from "../types/game.js";
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

// === Objectives (API with RPC fallback) ===

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

export function useObjectiveDetails(
  objectiveId: number | undefined,
  gameAddress: string | undefined,
): UseAsyncResult<GameObjectiveDetails> {
  const client = useDenshokanClient();
  return useAsync(
    () => client.getObjectiveDetails(objectiveId!, gameAddress!),
    [client, objectiveId, gameAddress],
    objectiveId !== undefined && !!gameAddress,
  );
}

export function useObjectivesDetails(
  gameAddress: string | undefined,
  params?: DetailsParams,
): UseAsyncResult<PaginatedResult<GameObjectiveDetails>> {
  const client = useDenshokanClient();
  const paramsKey = JSON.stringify(params);
  return useAsync(
    () => client.getObjectivesDetails(gameAddress!, params),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, gameAddress, paramsKey],
    !!gameAddress,
  );
}

// === Settings (API with RPC fallback) ===

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

export function useSettingDetails(
  settingsId: number | undefined,
  gameAddress: string | undefined,
): UseAsyncResult<GameSettingDetails> {
  const client = useDenshokanClient();
  return useAsync(
    () => client.getSettingDetails(settingsId!, gameAddress!),
    [client, settingsId, gameAddress],
    settingsId !== undefined && !!gameAddress,
  );
}

export function useSettingsDetails(
  gameAddress: string | undefined,
  params?: DetailsParams,
): UseAsyncResult<PaginatedResult<GameSettingDetails>> {
  const client = useDenshokanClient();
  const paramsKey = JSON.stringify(params);
  return useAsync(
    () => client.getSettingsDetails(gameAddress!, params),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, gameAddress, paramsKey],
    !!gameAddress,
  );
}
