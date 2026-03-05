import { useState, useEffect, useCallback, useRef } from "react";
import type { PlayerStats, PlayerTokensParams } from "../types/player.js";
import type { Token, PaginatedResult } from "../types/token.js";
import { useDenshokanClient } from "./context.js";

export interface UsePlayerStatsResult {
  data: PlayerStats | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function usePlayerStats(address: string | undefined): UsePlayerStatsResult {
  const client = useDenshokanClient();
  const [data, setData] = useState<PlayerStats | null>(null);
  const [isLoading, setIsLoading] = useState(!!address);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(() => {
    if (!address) return;
    setIsLoading(true);
    setError(null);
    client
      .getPlayerStats(address)
      .then(setData)
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, [client, address]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}

export interface UsePlayerTokensResult {
  data: PaginatedResult<Token> | null;
  isLoading: boolean;
  /** True while token URIs are being fetched in the background */
  isLoadingUri: boolean;
  error: Error | null;
  refetch: () => void;
}

export function usePlayerTokens(
  address: string | undefined,
  params?: PlayerTokensParams & { includeUri?: boolean },
): UsePlayerTokensResult {
  const client = useDenshokanClient();
  const [data, setData] = useState<PaginatedResult<Token> | null>(null);
  const [isLoading, setIsLoading] = useState(!!address);
  const [isLoadingUri, setIsLoadingUri] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const fetchIdRef = useRef(0);

  const { includeUri, ...tokenParams } = params ?? {};
  const paramsKey = JSON.stringify(tokenParams);

  const fetch = useCallback(() => {
    if (!address) return;
    const id = ++fetchIdRef.current;
    setIsLoading(true);
    setError(null);
    client
      .getPlayerTokens(address, tokenParams as PlayerTokensParams)
      .then((result) => {
        if (id !== fetchIdRef.current) return;
        setData(result);
        setIsLoading(false);

        // Enrich with URIs in the background — only for tokens missing a URI
        setIsLoadingUri(false);
        if (includeUri && result.data.length > 0) {
          const missingIndices = result.data
            .map((t, i) => (!t.tokenUri ? i : -1))
            .filter((i) => i >= 0);

          if (missingIndices.length > 0) {
            setIsLoadingUri(true);
            const missingIds = missingIndices.map((i) => result.data[i].tokenId);
            client
              .tokenUriBatch(missingIds)
              .then((uris) => {
                if (id !== fetchIdRef.current) return;
                setData((prev) =>
                  prev
                    ? {
                        ...prev,
                        data: prev.data.map((token, i) => {
                          const idx = missingIndices.indexOf(i);
                          return idx >= 0 && uris[idx]
                            ? { ...token, tokenUri: uris[idx] }
                            : token;
                        }),
                      }
                    : prev,
                );
              })
              .catch(() => {
                // URI fetch is best-effort
              })
              .finally(() => {
                if (id === fetchIdRef.current) setIsLoadingUri(false);
              });
          }
        }
      })
      .catch((err) => {
        if (id !== fetchIdRef.current) return;
        setError(err);
        setIsLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, address, paramsKey, includeUri]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, isLoading, isLoadingUri, error, refetch: fetch };
}
