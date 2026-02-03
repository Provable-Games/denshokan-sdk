import { useMemo } from "react";
import type { CoreToken } from "../types/token.js";
import { decodeCoreToken } from "../utils/token-id.js";

/**
 * React hook to decode a token ID into a CoreToken.
 * Pure computation - no RPC calls. Returns null if tokenId is undefined or invalid.
 */
export function useDecodeToken(tokenId: string | undefined): CoreToken | null {
  return useMemo(() => {
    if (!tokenId) return null;
    try {
      return decodeCoreToken(tokenId);
    } catch {
      return null;
    }
  }, [tokenId]);
}
