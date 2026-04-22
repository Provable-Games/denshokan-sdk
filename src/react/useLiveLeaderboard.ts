import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { Token, TokenSortField, TokensFilterParams } from "../types/token.js";
import type { ScoreEvent, GameOverEvent } from "../types/websocket.js";
import { useTokens } from "./useTokens.js";
import { useScoreUpdates, useGameOverEvents, useMintEvents } from "./useChannelSubscription.js";
import { useDenshokanClient } from "./context.js";
import { useResetOnClient } from "./useResetOnClient.js";

/** Map sort field names to Token object property names for client-side re-sorting */
const SORT_FIELD_TO_PROP: Record<TokenSortField, keyof Token> = {
  score: "score",
  mintedAt: "mintedAt",
  lastUpdatedAt: "lastUpdatedAt",
  completedAt: "completedAt",
};

export interface UseLiveLeaderboardOptions extends TokensFilterParams {
  /** Subscribe to score updates (default: true when enabled) */
  liveScores?: boolean;
  /** Subscribe to game_over updates (default: true when enabled) */
  liveGameOver?: boolean;
  /** Subscribe to mint events and trigger refetch (default: true when enabled) */
  liveMints?: boolean;
  /** Debounce window in ms for batching WS patches before re-sort (default: 300) */
  debounceMs?: number;
  /** Enable/disable the hook entirely */
  enabled?: boolean;
}

/** Minimal leaderboard entry — only the fields needed for display */
export interface LeaderboardEntry {
  tokenId: string;
  score: number;
  playerName: string | null;
  owner: string;
  gameOver: boolean;
  rank: number;
  /** ISO timestamp of when the token was minted (useful as a tie-breaker) */
  mintedAt: string;
}

export interface UseLiveLeaderboardResult {
  /** Current page of leaderboard entries, sorted and ranked */
  entries: LeaderboardEntry[];
  /** Total matching tokens across all pages (for pagination controls) */
  total: number;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

function toEntry(token: Token, rank: number): LeaderboardEntry {
  return {
    tokenId: token.tokenId,
    score: token.score,
    playerName: token.playerName,
    owner: token.owner,
    gameOver: token.gameOver,
    rank,
    mintedAt: token.mintedAt,
  };
}

export function useLiveLeaderboard(
  options: UseLiveLeaderboardOptions = {},
): UseLiveLeaderboardResult {
  const {
    liveScores = true,
    liveGameOver = true,
    liveMints = true,
    debounceMs = 300,
    enabled = true,
    ...filterParams
  } = options;

  const apiSortField = filterParams.sort?.field ?? "score";
  const sortField = SORT_FIELD_TO_PROP[apiSortField];
  const sortDir = filterParams.sort?.direction ?? "desc";
  const pageOffset = filterParams.offset ?? 0;
  const pageLimit = filterParams.limit;

  // HTTP fetch — server handles sort + pagination
  const {
    data: httpResult,
    isLoading,
    refetch,
  } = useTokens(enabled ? filterParams : undefined);

  // Base token map from HTTP data (current page only)
  const tokenMapRef = useRef<Map<string, Token>>(new Map());
  const pendingRef = useRef<Map<string, Partial<Token>>>(new Map());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the lowest score on the current page for threshold checks
  const pageMinScoreRef = useRef<number>(-Infinity);

  const client = useDenshokanClient();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  const resetEntries = useCallback(() => setEntries([]), []);
  useResetOnClient(client, resetEntries);

  // Re-sort within the current page and assign ranks accounting for offset
  const sortAndRank = useCallback(
    (list: Token[]): LeaderboardEntry[] => {
      const sorted = [...list].sort((a, b) => {
        const aVal = (a as unknown as Record<string, unknown>)[sortField];
        const bVal = (b as unknown as Record<string, unknown>)[sortField];
        if (typeof aVal === "number" && typeof bVal === "number") {
          const cmp = sortDir === "desc" ? bVal - aVal : aVal - bVal;
          if (cmp !== 0) return cmp;
        }
        // Secondary sort: mintedAt ascending for stable ordering (earlier mint wins ties)
        return new Date(a.mintedAt).getTime() - new Date(b.mintedAt).getTime();
      });
      // Update the page minimum score for threshold checks
      if (sorted.length > 0 && pageLimit && sorted.length >= pageLimit) {
        const edge = sorted[sorted.length - 1];
        const edgeScore = (edge as unknown as Record<string, unknown>)[sortField];
        pageMinScoreRef.current = typeof edgeScore === "number" ? edgeScore : -Infinity;
      } else {
        // Page isn't full — any score could belong here
        pageMinScoreRef.current = -Infinity;
      }
      return sorted.map((token, i) => toEntry(token, pageOffset + i + 1));
    },
    [sortField, sortDir, pageOffset, pageLimit],
  );

  // Sync HTTP data into tokenMapRef + update output
  useEffect(() => {
    if (!httpResult) return;
    const map = new Map<string, Token>();
    for (const token of httpResult.data) {
      map.set(token.tokenId, token);
    }
    tokenMapRef.current = map;
    pendingRef.current.clear();
    setEntries(sortAndRank(httpResult.data));
  }, [httpResult, sortAndRank]);

  // Flush pending patches
  const flushPatches = useCallback(() => {
    const pending = pendingRef.current;
    if (pending.size === 0) return;

    const map = tokenMapRef.current;
    for (const [tokenId, patch] of pending) {
      const existing = map.get(tokenId);
      if (existing) {
        map.set(tokenId, { ...existing, ...patch });
      }
    }
    pending.clear();
    setEntries(sortAndRank(Array.from(map.values())));
  }, [sortAndRank]);

  const scheduleFlush = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      flushPatches();
      debounceTimerRef.current = null;
    }, debounceMs);
  }, [flushPatches, debounceMs]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // Debounced refetch for off-page events that cross the score threshold.
  // Shared by score, game_over, and mint handlers — multiple rapid events
  // coalesce into a single refetch.
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefetch = useCallback(() => {
    if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    refetchTimerRef.current = setTimeout(() => {
      refetch();
      refetchTimerRef.current = null;
    }, 500);
  }, [refetch]);

  useEffect(() => {
    return () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    };
  }, []);

  /** Check if an off-page score would displace an entry on the current page */
  const wouldEnterPage = useCallback(
    (score: number): boolean => {
      const min = pageMinScoreRef.current;
      if (min === -Infinity) return true; // page not full, any score belongs
      return sortDir === "desc" ? score > min : score < min;
    },
    [sortDir],
  );

  // Score updates
  const onScoreEvent = useCallback(
    (event: ScoreEvent) => {
      if (tokenMapRef.current.has(event.tokenId)) {
        // Known token on this page — patch in-place
        pendingRef.current.set(event.tokenId, {
          ...(pendingRef.current.get(event.tokenId) ?? {}),
          score: event.score,
          playerName: event.playerName,
        });
        scheduleFlush();
      } else if (wouldEnterPage(event.score)) {
        // Off-page token scored above the page threshold — refetch
        scheduleRefetch();
      }
    },
    [scheduleFlush, scheduleRefetch, wouldEnterPage],
  );

  // Derive WS filters from TokensFilterParams for server-side event filtering
  const wsGameIds = filterParams.gameId != null ? [filterParams.gameId] : undefined;
  const wsContextIds = filterParams.contextId != null ? [filterParams.contextId] : undefined;
  const wsMinterAddresses = filterParams.minterAddress != null ? [filterParams.minterAddress] : undefined;
  const wsOwners = filterParams.owner != null ? [filterParams.owner] : undefined;
  const wsSettingsIds = filterParams.settingsId != null ? [filterParams.settingsId] : undefined;
  const wsObjectiveIds = filterParams.objectiveId != null ? [filterParams.objectiveId] : undefined;
  const wsFilters = { gameIds: wsGameIds, contextIds: wsContextIds, minterAddresses: wsMinterAddresses, owners: wsOwners, settingsIds: wsSettingsIds, objectiveIds: wsObjectiveIds };

  useScoreUpdates({ enabled: enabled && liveScores, onEvent: onScoreEvent, ...wsFilters });

  // Game over updates
  const onGameOverEvent = useCallback(
    (event: GameOverEvent) => {
      if (tokenMapRef.current.has(event.tokenId)) {
        // Known token on this page — patch in-place
        pendingRef.current.set(event.tokenId, {
          ...(pendingRef.current.get(event.tokenId) ?? {}),
          score: event.score,
          gameOver: true,
          playerName: event.playerName,
        });
        scheduleFlush();
      } else if (wouldEnterPage(event.score)) {
        // Off-page token scored above the page threshold — refetch
        scheduleRefetch();
      }
    },
    [scheduleFlush, scheduleRefetch, wouldEnterPage],
  );

  useGameOverEvents({ enabled: enabled && liveGameOver, onEvent: onGameOverEvent, ...wsFilters });

  // Mint events → debounced refetch (new token, total count changed)
  const onMintEvent = useCallback(() => {
    scheduleRefetch();
  }, [scheduleRefetch]);

  useMintEvents({ enabled: enabled && liveMints, onEvent: onMintEvent, ...wsFilters });

  const total = httpResult?.total ?? 0;

  return useMemo(
    () => ({ entries, total, isLoading, refetch }),
    [entries, total, isLoading, refetch],
  );
}
