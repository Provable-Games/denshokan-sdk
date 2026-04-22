import { useState, useEffect, useCallback, useRef } from "react";
import type { TokenRank, TokenRankParams } from "../types/token.js";
import type { ScoreEvent, GameOverEvent } from "../types/websocket.js";
import { useDenshokanClient } from "./context.js";
import { useScoreUpdates, useGameOverEvents } from "./useChannelSubscription.js";
import { useResetOnClient } from "./useResetOnClient.js";

export interface UseTokenRankOptions extends TokenRankParams {
  /** Subscribe to score/game-over WS events in scope and refetch rank (default: false) */
  live?: boolean;
  /** Debounce window in ms for batching WS-triggered refetches (default: 500) */
  debounceMs?: number;
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
  const { live = false, debounceMs = 500, enabled = true, ...scope } = options;

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

  // Debounced refetch used by the WS handlers below. Multiple rapid events
  // coalesce into a single server call.
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefetch = useCallback(() => {
    if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    refetchTimerRef.current = setTimeout(() => {
      fetch();
      refetchTimerRef.current = null;
    }, debounceMs);
  }, [fetch, debounceMs]);

  useEffect(() => {
    return () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    };
  }, []);

  // Narrow WS server-side to the same scope so we don't wake up on irrelevant
  // events. We can't cheaply tell on the client whether a particular event
  // shifts *this* token's rank, so any matching event triggers a refetch.
  const wsFilters = {
    gameIds: scope.gameId != null ? [scope.gameId] : undefined,
    contextIds: scope.contextId != null ? [scope.contextId] : undefined,
    minterAddresses: scope.minterAddress != null ? [scope.minterAddress] : undefined,
    owners: scope.owner != null ? [scope.owner] : undefined,
    settingsIds: scope.settingsId != null ? [scope.settingsId] : undefined,
    objectiveIds: scope.objectiveId != null ? [scope.objectiveId] : undefined,
  };

  const onScoreEvent = useCallback(
    (_event: ScoreEvent) => { scheduleRefetch(); },
    [scheduleRefetch],
  );
  const onGameOverEvent = useCallback(
    (_event: GameOverEvent) => { scheduleRefetch(); },
    [scheduleRefetch],
  );

  useScoreUpdates({ enabled: enabled && live, onEvent: onScoreEvent, ...wsFilters });
  useGameOverEvents({ enabled: enabled && live, onEvent: onGameOverEvent, ...wsFilters });

  return { data, isLoading, error, refetch: fetch };
}
