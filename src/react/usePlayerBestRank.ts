import { useState, useEffect, useCallback, useRef } from "react";
import type { TokenRank, PlayerRankParams } from "../types/token.js";
import type { ScoreEvent, GameOverEvent, MintEvent } from "../types/websocket.js";
import { useDenshokanClient } from "./context.js";
import {
  useScoreUpdates,
  useGameOverEvents,
  useMintEvents,
} from "./useChannelSubscription.js";
import { useResetOnClient } from "./useResetOnClient.js";

export interface UsePlayerBestRankOptions extends PlayerRankParams {
  /**
   * Subscribe to score/game-over/mint WS events and refetch on relevant
   * changes (default: false). When on:
   *   - any scope-matching score/game-over event triggers a refetch (a peer
   *     climbing could push the player's token down; or the player's own
   *     token improving changes its rank)
   *   - any mint event where the player is the recipient triggers a refetch
   *     (a new token could be the new best rank)
   */
  live?: boolean;
  /** Debounce window in ms for batching WS-triggered refetches (default: 500) */
  debounceMs?: number;
  /** Enable/disable the hook entirely */
  enabled?: boolean;
}

export interface UsePlayerBestRankResult {
  data: TokenRank | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function usePlayerBestRank(
  address: string | undefined,
  options: UsePlayerBestRankOptions = {},
): UsePlayerBestRankResult {
  const { live = false, debounceMs = 500, enabled = true, ...scope } = options;

  const client = useDenshokanClient();
  const [data, setData] = useState<TokenRank | null>(null);
  const [isLoading, setIsLoading] = useState(!!address && enabled);
  const [error, setError] = useState<Error | null>(null);

  useResetOnClient(client, setData, setError);

  const scopeKey = JSON.stringify(scope);

  const fetch = useCallback(async () => {
    if (!address || !enabled) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await client.getPlayerBestRank(address, scope);
      setData(result);
    } catch (e) {
      setError(e as Error);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, address, enabled, scopeKey]);

  useEffect(() => { fetch(); }, [fetch]);

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

  // Scope filters for scope-wide events (scores, game_over)
  const scopeFilters = {
    gameIds: scope.gameId != null ? [scope.gameId] : undefined,
    contextIds: scope.contextId != null ? [scope.contextId] : undefined,
    minterAddresses: scope.minterAddress != null ? [scope.minterAddress] : undefined,
    settingsIds: scope.settingsId != null ? [scope.settingsId] : undefined,
    objectiveIds: scope.objectiveId != null ? [scope.objectiveId] : undefined,
  };

  // Mint filter uses the player's address as owner — only care about tokens
  // they're receiving, not the whole scope
  const mintFilters = {
    ...scopeFilters,
    owners: address != null ? [address] : undefined,
  };

  const onScoreEvent = useCallback(
    (_event: ScoreEvent) => { scheduleRefetch(); },
    [scheduleRefetch],
  );
  const onGameOverEvent = useCallback(
    (_event: GameOverEvent) => { scheduleRefetch(); },
    [scheduleRefetch],
  );
  const onMintEvent = useCallback(
    (_event: MintEvent) => { scheduleRefetch(); },
    [scheduleRefetch],
  );

  useScoreUpdates({ enabled: enabled && live, onEvent: onScoreEvent, ...scopeFilters });
  useGameOverEvents({ enabled: enabled && live, onEvent: onGameOverEvent, ...scopeFilters });
  useMintEvents({ enabled: enabled && live, onEvent: onMintEvent, ...mintFilters });

  return { data, isLoading, error, refetch: fetch };
}
