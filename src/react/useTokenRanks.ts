import { useState, useEffect, useCallback, useRef } from "react";
import type { TokenRankParams, TokenRanksResult } from "../types/token.js";
import type { ScoreEvent, GameOverEvent } from "../types/websocket.js";
import { useDenshokanClient } from "./context.js";
import { useScoreUpdates, useGameOverEvents } from "./useChannelSubscription.js";
import { useResetOnClient } from "./useResetOnClient.js";

export interface UseTokenRanksOptions extends TokenRankParams {
  /** Subscribe to score/game-over WS events in scope and refetch ranks (default: false) */
  live?: boolean;
  /** Debounce window in ms for batching WS-triggered refetches (default: 500) */
  debounceMs?: number;
  /** Enable/disable the hook entirely */
  enabled?: boolean;
}

export interface UseTokenRanksResult {
  data: TokenRanksResult | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Bulk version of `useTokenRank`. Fetches ranks for a list of token ids in a
 * single round-trip. Use when you need ranks for many tokens within the same
 * scope — for example, finding which tokens a wallet currently holds placed
 * in a paid position across several finalized tournaments.
 *
 * Tokens missing from scope are listed in `data.notFound` rather than thrown.
 * Empty input → no fetch, `data` stays `null`.
 */
export function useTokenRanks(
  tokenIds: string[] | undefined,
  options: UseTokenRanksOptions = {},
): UseTokenRanksResult {
  const { live = false, debounceMs = 500, enabled = true, ...scope } = options;

  const client = useDenshokanClient();
  const [data, setData] = useState<TokenRanksResult | null>(null);
  const [isLoading, setIsLoading] = useState(
    !!tokenIds && tokenIds.length > 0 && enabled,
  );
  const [error, setError] = useState<Error | null>(null);

  useResetOnClient(client, setData, setError);

  // Stable keys so callers passing new array/object literals each render don't
  // retrigger fetches when the underlying values are identical.
  const idsKey = tokenIds ? tokenIds.join(",") : "";
  const scopeKey = JSON.stringify(scope);

  const fetch = useCallback(async () => {
    if (!enabled) return;
    if (!tokenIds || tokenIds.length === 0) {
      setData({ data: [], notFound: [] });
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await client.getTokenRanks(tokenIds, scope);
      setData(result);
    } catch (e) {
      setError(e as Error);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, idsKey, enabled, scopeKey]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Debounced refetch used by WS handlers below.
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

  // Narrow WS server-side to the same scope; any matching event refetches.
  // We can't cheaply tell client-side whether a given event affects one of
  // the tokens we're tracking.
  const wsFilters = {
    gameIds: scope.gameId != null ? [scope.gameId] : undefined,
    contextIds: scope.contextId != null ? [scope.contextId] : undefined,
    minterAddresses:
      scope.minterAddress != null ? [scope.minterAddress] : undefined,
    owners: scope.owner != null ? [scope.owner] : undefined,
    settingsIds: scope.settingsId != null ? [scope.settingsId] : undefined,
    objectiveIds: scope.objectiveId != null ? [scope.objectiveId] : undefined,
  };

  const onScoreEvent = useCallback(
    (_event: ScoreEvent) => {
      scheduleRefetch();
    },
    [scheduleRefetch],
  );
  const onGameOverEvent = useCallback(
    (_event: GameOverEvent) => {
      scheduleRefetch();
    },
    [scheduleRefetch],
  );

  useScoreUpdates({
    enabled: enabled && live,
    onEvent: onScoreEvent,
    ...wsFilters,
  });
  useGameOverEvents({
    enabled: enabled && live,
    onEvent: onGameOverEvent,
    ...wsFilters,
  });

  return { data, isLoading, error, refetch: fetch };
}
