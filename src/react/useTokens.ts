import { useState, useEffect, useCallback } from "react";
import type { Token, PaginatedResult, TokensFilterParams, TokenScoreEntry } from "../types/token.js";
import { useDenshokanClient } from "./context.js";

export interface UseTokensResult {
  data: PaginatedResult<Token> | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useTokens(params?: TokensFilterParams): UseTokensResult {
  const client = useDenshokanClient();
  const [data, setData] = useState<PaginatedResult<Token> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const paramsKey = JSON.stringify(params);

  const fetch = useCallback(() => {
    setIsLoading(true);
    setError(null);
    client
      .getTokens(params)
      .then(setData)
      .catch(setError)
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, paramsKey]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
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
