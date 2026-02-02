import type { FetchConfig } from "../types/config.js";
import { isNonRetryableError, AbortError, TimeoutError } from "../errors/index.js";

export const DEFAULT_FETCH_CONFIG: Required<FetchConfig> = {
  timeout: 10000,
  maxRetries: 3,
  baseBackoff: 1000,
  maxBackoff: 5000,
};

export function calculateBackoff(
  attempt: number,
  baseBackoff: number,
  maxBackoff: number,
): number {
  let delay = baseBackoff * Math.pow(2, attempt);
  if (delay > maxBackoff) delay = maxBackoff;
  const minDelay = delay / 2;
  const jitter = Math.random() * (delay - minDelay);
  return minDelay + jitter;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RetryOptions {
  maxRetries: number;
  baseBackoff: number;
  maxBackoff: number;
  signal?: AbortSignal;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const { maxRetries, baseBackoff, maxBackoff, signal } = options;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (signal?.aborted) {
      throw new AbortError();
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (error instanceof Error && error.name === "AbortError") {
        throw new AbortError();
      }

      if (isNonRetryableError(error)) {
        throw error;
      }

      if (attempt === maxRetries - 1) break;

      const delay = calculateBackoff(attempt, baseBackoff, maxBackoff);
      await sleep(delay);
    }
  }

  throw lastError || new TimeoutError("Unknown error after retries");
}
