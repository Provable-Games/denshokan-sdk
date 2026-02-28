import { useState, useEffect, useCallback, useRef } from "react";
import type { Token, PaginatedResult, TokensFilterParams, TokenScoreEntry } from "../types/token.js";
import { useDenshokanClient } from "./context.js";

export interface UseTokensResult {
  data: PaginatedResult<Token> | null;
  isLoading: boolean;
  /** True while token URIs are being fetched in the background */
  isLoadingUri: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useTokens(params?: TokensFilterParams): UseTokensResult {
  const client = useDenshokanClient();
  const [data, setData] = useState<PaginatedResult<Token> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingUri, setIsLoadingUri] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const fetchIdRef = useRef(0);

  const { includeUri, ...filterParams } = params ?? {};
  const paramsKey = JSON.stringify(filterParams);

  const fetch = useCallback(() => {
    const id = ++fetchIdRef.current;
    setIsLoading(true);
    setError(null);
    client
      .getTokens(filterParams as TokensFilterParams)
      .then((result) => {
        if (id !== fetchIdRef.current) return;
        setData(result);
        setIsLoading(false);

        // Enrich with URIs in the background
        if (includeUri && result.data.length > 0) {
          setIsLoadingUri(true);
          const tokenIds = result.data.map((t) => t.tokenId);
          client
            .tokenUriBatch(tokenIds)
            .then((uris) => {
              if (id !== fetchIdRef.current) return;
              setData((prev) =>
                prev
                  ? {
                      ...prev,
                      data: prev.data.map((token, i) => ({
                        ...token,
                        tokenUri: uris[i] || token.tokenUri,
                      })),
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
      })
      .catch((err) => {
        if (id !== fetchIdRef.current) return;
        setError(err);
        setIsLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, paramsKey, includeUri]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, isLoading, isLoadingUri, error, refetch: fetch };
}

export interface UseTokenResult {
  data: Token | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useToken(tokenId: string | undefined): UseTokenResult {
  const client = useDenshokanClient();
  const [data, setData] = useState<Token | null>(null);
  const [isLoading, setIsLoading] = useState(!!tokenId);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(() => {
    if (!tokenId) return;
    setIsLoading(true);
    setError(null);
    client
      .getToken(tokenId)
      .then(setData)
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, [client, tokenId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}

export interface UseTokenScoresResult {
  data: TokenScoreEntry[] | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useTokenScores(
  tokenId: string | undefined,
  limit?: number,
): UseTokenScoresResult {
  const client = useDenshokanClient();
  const [data, setData] = useState<TokenScoreEntry[] | null>(null);
  const [isLoading, setIsLoading] = useState(!!tokenId);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(() => {
    if (!tokenId) return;
    setIsLoading(true);
    setError(null);
    client
      .getTokenScores(tokenId, limit)
      .then(setData)
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, [client, tokenId, limit]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}
