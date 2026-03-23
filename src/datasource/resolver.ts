import type { ConnectionStatus } from "./health.js";
import { ApiError, DataSourceError } from "../errors/index.js";

/**
 * Check if an error is a client-side error (4xx) that should NOT trigger
 * fallback or mark the API as unavailable. A 404 means the API is working
 * fine — the specific resource just doesn't exist.
 */
function isClientError(error: unknown): boolean {
  return error instanceof ApiError
    && error.statusCode >= 400
    && error.statusCode < 500
    && error.statusCode !== 429;
}

export async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  health?: ConnectionStatus,
): Promise<T> {
  // If health monitoring shows primary source is down, skip it
  if (health) {
    const mode = health.mode;
    if (mode === "rpc-fallback") {
      // API is known-down, go straight to RPC fallback
      try {
        return await fallback();
      } catch (fallbackError) {
        throw fallbackError;
      }
    }

    if (mode === "offline") {
      // Both are known-down, still try both in order
    }
  }

  let primaryError: Error;
  try {
    return await primary();
  } catch (error) {
    primaryError = error as Error;
    // Only mark API unavailable for server/network errors, not 4xx client errors.
    // A 404 means the API is healthy — the resource just doesn't exist.
    if (isClientError(error)) {
      throw primaryError;
    }
    if (health) {
      health.markApiUnavailable(primaryError.message);
    }
  }

  try {
    return await fallback();
  } catch (fallbackError) {
    if (health) {
      health.markRpcUnavailable((fallbackError as Error).message);
    }
    throw new DataSourceError(primaryError, fallbackError as Error);
  }
}
