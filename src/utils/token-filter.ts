import type { Token, TokensFilterParams } from "../types/token.js";

/**
 * Apply the token filters CLIENT-SIDE against already-built Token objects. Used by the
 * RPC token fallback (`buildTokensFromRpc`'s by-ids path) so an API-down result matches
 * what `POST /tokens/query` / `GET /tokens` would have returned server-side.
 *
 * Covers every filter expressible on a built Token. NOT applied: `minterAddress` — the
 * RPC full-state batch doesn't reliably resolve the full minter address (only the
 * truncated `mintedBy`), so it's API-only; a `{ minterAddress }` filter is ignored here
 * rather than wrongly dropping rows. `gameAddress` is a resolution input, not a filter.
 */
export function applyTokenFilters(tokens: Token[], params: TokensFilterParams): Token[] {
  let out = tokens;
  const {
    gameId,
    owner,
    gameOver,
    settingsId,
    objectiveId,
    soulbound,
    playable,
    hasContext,
    contextId,
    contextName,
    mintedAfter,
    mintedBefore,
  } = params;

  if (gameId !== undefined) out = out.filter((t) => t.gameId === gameId);
  if (owner) {
    const o = owner.toLowerCase();
    out = out.filter((t) => t.owner?.toLowerCase() === o);
  }
  if (gameOver !== undefined) out = out.filter((t) => t.gameOver === gameOver);
  if (settingsId !== undefined) out = out.filter((t) => t.settingsId === settingsId);
  if (objectiveId !== undefined) out = out.filter((t) => t.objectiveId === objectiveId);
  if (soulbound !== undefined) out = out.filter((t) => t.soulbound === soulbound);
  if (playable !== undefined) out = out.filter((t) => t.isPlayable === playable);
  if (hasContext !== undefined) out = out.filter((t) => t.hasContext === hasContext);
  if (contextId !== undefined) out = out.filter((t) => t.contextId === contextId);
  if (contextName !== undefined) out = out.filter((t) => t.contextName === contextName);
  if (mintedAfter !== undefined || mintedBefore !== undefined) {
    const after = mintedAfter ?? 0;
    const before = mintedBefore ?? Number.MAX_SAFE_INTEGER;
    out = out.filter((t) => {
      const ts = Math.floor(Date.parse(t.mintedAt) / 1000);
      return ts >= after && ts <= before;
    });
  }
  return out;
}
