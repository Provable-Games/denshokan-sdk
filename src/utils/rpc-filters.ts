import type { Token, TokensQueryParams } from "../types/token.js";

const _warned = new Set<string>();

/** Emit a one-time console.warn per unique key (the SDK has no logger). */
function warnOnce(key: string, message: string): void {
  if (_warned.has(key)) return;
  _warned.add(key);
  // eslint-disable-next-line no-console
  console.warn(`[denshokan-sdk] ${message}`);
}

/** Test hook: reset the one-time-warning dedupe set. */
export function _resetRpcFilterWarnings(): void {
  _warned.clear();
}

/**
 * Reconcile filters the RPC fallback can't push down to the viewer contract.
 *
 * The viewer exposes only a subset of filters natively (game / owner / minter /
 * settings / objective / soulbound / playable / gameOver=true / minted-range),
 * and only in specific combinations. Anything else — or a supported filter used
 * in a combination with no matching viewer method — is applied here client-side
 * on the current page as a best-effort safety net, with a one-time warning.
 * Because it runs after on-chain pagination, `total` and page boundaries become
 * approximate whenever it actually removes rows.
 *
 * Policy (filter-consistency plan): warn + best-effort, never throw. The RPC
 * fallback runs precisely when the API is down, so failing hard would turn a
 * degraded read into no read at all.
 *
 * Notably `gameOver: false` has no on-chain method (it's a completeness filter,
 * not a playability one) — callers wanting "active games" should use
 * `playable: true`, which the viewer supports natively.
 */
export function applyRpcBestEffortFilters(
  tokens: Token[],
  total: number,
  params?: TokensQueryParams,
): { tokens: Token[]; total: number } {
  if (!params) return { tokens, total };

  let result = tokens;
  let approximate = false;

  /** Apply a predicate; if it drops rows, the filter wasn't native — warn. */
  const net = (
    key: string,
    requested: boolean,
    pred: (t: Token) => boolean,
    message: string,
  ): void => {
    if (!requested) return;
    const before = result.length;
    result = result.filter(pred);
    if (result.length !== before) {
      approximate = true;
      warnOnce(key, message);
    }
  };

  net(
    params.gameOver === false ? "gameOver:false" : "gameOver:true",
    params.gameOver !== undefined,
    (t) => t.gameOver === params.gameOver,
    params.gameOver === false
      ? "RPC fallback: `gameOver: false` has no on-chain filter — use `playable: true` for active games. Applied client-side (pagination/total approximate)."
      : "RPC fallback: `gameOver` applied client-side (pagination/total approximate).",
  );

  net(
    "playable",
    params.playable === true,
    (t) => t.isPlayable,
    "RPC fallback: `playable` applied client-side for this filter combination (pagination/total approximate).",
  );

  net(
    "settingsId",
    params.settingsId !== undefined,
    (t) => t.settingsId === params.settingsId,
    "RPC fallback: `settingsId` applied client-side for this filter combination (pagination/total approximate).",
  );

  net(
    "objectiveId",
    params.objectiveId !== undefined,
    (t) => t.objectiveId === params.objectiveId,
    "RPC fallback: `objectiveId` applied client-side for this filter combination (pagination/total approximate).",
  );

  net(
    "soulbound",
    params.soulbound !== undefined,
    (t) => t.soulbound === params.soulbound,
    "RPC fallback: `soulbound` applied client-side for this filter combination (pagination/total approximate).",
  );

  net(
    "hasContext",
    params.hasContext !== undefined,
    (t) => t.hasContext === params.hasContext,
    "RPC fallback: `hasContext` applied client-side (pagination/total approximate).",
  );

  net(
    "contextId",
    params.contextId !== undefined,
    (t) => (t.contextId !== null ? t.contextId === params.contextId : t.hasContext),
    "RPC fallback: `contextId` applied client-side (pagination/total approximate).",
  );

  if (params.mintedAfter !== undefined || params.mintedBefore !== undefined) {
    net(
      "mintedRange",
      true,
      (t) => {
        const ts = Math.floor(new Date(t.mintedAt).getTime() / 1000);
        if (params.mintedAfter !== undefined && ts < params.mintedAfter) return false;
        if (params.mintedBefore !== undefined && ts > params.mintedBefore) return false;
        return true;
      },
      "RPC fallback: minted-time range applied client-side for this filter combination (pagination/total approximate).",
    );
  }

  // Not expressible over RPC at all — honored only on the API datasource.
  if (params.contextName !== undefined) {
    warnOnce("contextName", "RPC fallback: `contextName` is unavailable over RPC and was ignored.");
  }
  if (params.sort) {
    warnOnce("sort", "RPC fallback: `sort` is not supported; results use contract iteration order.");
  }

  return { tokens: result, total: approximate ? result.length : total };
}
