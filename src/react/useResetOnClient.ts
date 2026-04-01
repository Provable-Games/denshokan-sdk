import { useEffect } from "react";
import type { DenshokanClient } from "../client.js";

/**
 * Resets state setters to null when the client reference changes (network switch).
 * Prevents stale data from a previous network being displayed while new data loads.
 */
export function useResetOnClient(
  client: DenshokanClient,
  ...resetters: Array<((value: null) => void) | (() => void)>
): void {
  useEffect(() => {
    for (const reset of resetters) {
      reset(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);
}
