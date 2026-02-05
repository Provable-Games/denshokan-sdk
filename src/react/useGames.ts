import { useState, useEffect, useCallback } from "react";
import type { Game, GameStats } from "../types/game.js";
import type { PaginatedResult } from "../types/token.js";
import { useDenshokanClient } from "./context.js";

export interface GamesParams {
  limit?: number;
  offset?: number;
}

export interface UseGamesResult {
  data: PaginatedResult<Game> | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useGames(params?: GamesParams): UseGamesResult {
  const client = useDenshokanClient();
  const [data, setData] = useState<PaginatedResult<Game> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const paramsKey = JSON.stringify(params);

  const fetch = useCallback(() => {
    setIsLoading(true);
    setError(null);
    client
      .getGames(params)
      .then(setData)
      .catch(setError)
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, paramsKey]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}

export interface UseGameResult {
  data: Game | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useGame(gameAddress: string | undefined): UseGameResult {
  const client = useDenshokanClient();
  const [data, setData] = useState<Game | null>(null);
  const [isLoading, setIsLoading] = useState(!!gameAddress);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(() => {
    if (gameAddress === undefined) return;
    setIsLoading(true);
    setError(null);
    client
      .getGame(gameAddress)
      .then(setData)
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, [client, gameAddress]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}

export interface UseGameStatsResult {
  data: GameStats | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useGameStats(gameAddress: string | undefined): UseGameStatsResult {
  const client = useDenshokanClient();
  const [data, setData] = useState<GameStats | null>(null);
  const [isLoading, setIsLoading] = useState(!!gameAddress);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(() => {
    if (gameAddress === undefined) return;
    setIsLoading(true);
    setError(null);
    client
      .getGameStats(gameAddress)
      .then(setData)
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, [client, gameAddress]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}
