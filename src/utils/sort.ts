import type { Token, TokenSortField } from "../types/token.js";

const SORT_FIELD_TO_PROP: Record<TokenSortField, keyof Token> = {
  score: "score",
  mintedAt: "mintedAt",
  lastUpdatedAt: "lastUpdatedAt",
  completedAt: "completedAt",
};

function compareTiebreak(a: Token, b: Token): number {
  const am = Date.parse(a.mintedAt);
  const bm = Date.parse(b.mintedAt);
  if (!Number.isNaN(am) && !Number.isNaN(bm) && am !== bm) return am - bm;
  // Final fallback matches the on-chain wins_tiebreak: lower tokenId wins.
  // tokenIds are felt252 hex strings; compare as bigints.
  try {
    const at = BigInt(a.tokenId);
    const bt = BigInt(b.tokenId);
    if (at < bt) return -1;
    if (at > bt) return 1;
  } catch {
    // Non-bigint-parseable tokenId — fall through to string compare
    if (a.tokenId < b.tokenId) return -1;
    if (a.tokenId > b.tokenId) return 1;
  }
  return 0;
}

/**
 * Stable token ordering with the on-chain leaderboard tiebreak applied.
 *
 * Mirrors `wins_tiebreak` in
 * `game-components/.../leaderboard/leaderboard.cairo`: equal-key entries
 * are ordered by earlier `mintedAt` first, then by lower `tokenId`. This
 * lets clients assign positions that match the order the leaderboard
 * contract enforces at `submit_score` time.
 *
 * The primary sort (when provided) is applied first; the tiebreak only
 * affects entries that compare equal on the primary key. When no `sort`
 * is passed, only the tiebreak is applied — useful as a stable canonical
 * ordering for unsorted result sets.
 */
export function sortTokensWithTiebreak(
  tokens: Token[],
  sort?: { field: TokenSortField; direction: "asc" | "desc" } | undefined,
): Token[] {
  const prop = sort ? SORT_FIELD_TO_PROP[sort.field] : null;
  const dir = sort?.direction ?? "desc";

  return [...tokens].sort((a, b) => {
    if (prop) {
      const aVal = (a as unknown as Record<string, unknown>)[prop];
      const bVal = (b as unknown as Record<string, unknown>)[prop];
      if (typeof aVal === "number" && typeof bVal === "number") {
        const cmp = dir === "desc" ? bVal - aVal : aVal - bVal;
        if (cmp !== 0) return cmp;
      } else if (typeof aVal === "string" && typeof bVal === "string") {
        // ISO 8601 strings compare lexicographically
        const cmp = dir === "desc" ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
        if (cmp !== 0) return cmp;
      }
    }
    return compareTiebreak(a, b);
  });
}
