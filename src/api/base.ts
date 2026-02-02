import type { FetchConfig } from "../types/config.js";
import { ApiError, RateLimitError, TimeoutError, AbortError } from "../errors/index.js";
import { withRetry, DEFAULT_FETCH_CONFIG } from "../utils/retry.js";

export interface ApiFetchOptions {
  baseUrl: string;
  path: string;
  signal?: AbortSignal;
  fetchConfig?: Partial<FetchConfig>;
}

export async function apiFetch<T>(options: ApiFetchOptions): Promise<T> {
  const { baseUrl, path, signal } = options;
  const config = { ...DEFAULT_FETCH_CONFIG, ...options.fetchConfig };

  return withRetry(
    async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);

      // Link external signal
      if (signal) {
        if (signal.aborted) {
          clearTimeout(timeoutId);
          throw new AbortError();
        }
        signal.addEventListener("abort", () => controller.abort(), { once: true });
      }

      try {
        const response = await fetch(`${baseUrl}${path}`, {
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          const retryMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : null;
          throw new RateLimitError("Rate limited", retryMs);
        }

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new ApiError(
            (body as Record<string, string>).error || `API error: ${response.status}`,
            response.status,
          );
        }

        return (await response.json()) as T;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof ApiError || error instanceof RateLimitError || error instanceof AbortError) {
          throw error;
        }
        if (error instanceof Error && error.name === "AbortError") {
          if (signal?.aborted) throw new AbortError();
          throw new TimeoutError();
        }
        throw error;
      }
    },
    {
      maxRetries: config.maxRetries,
      baseBackoff: config.baseBackoff,
      maxBackoff: config.maxBackoff,
      signal,
    },
  );
}

export function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) qs.set(key, String(value));
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}
