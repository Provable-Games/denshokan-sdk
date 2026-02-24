/**
 * Maximum salt value (10-bit field: 0–1023).
 * Used as a bitmask: `value & MAX_SALT` wraps into range.
 */
export const MAX_SALT = 1023;

/**
 * Auto-incrementing salt counter for multicall minting.
 *
 * Within a single Starknet transaction the `tx_hash` is shared by every mint,
 * so the 10-bit `salt` field in the packed token ID is the only source of
 * uniqueness. Use one counter per multicall batch.
 *
 * ```ts
 * const salt = new MintSaltCounter();
 * const calls = [
 *   contract.populate("mint", [..., salt.next()]),  // 0
 *   contract.populate("mint", [..., salt.next()]),  // 1
 * ];
 * await account.execute(calls);
 * ```
 */
export class MintSaltCounter {
  private _current: number;

  constructor(start = 0) {
    this._current = start & MAX_SALT;
  }

  /** Return the current value and advance. Wraps at 1023 → 0. */
  next(): number {
    const v = this._current;
    this._current = (this._current + 1) & MAX_SALT;
    return v;
  }

  /** Return the current value without advancing. */
  peek(): number {
    return this._current;
  }

  /** Reset the counter. */
  reset(start = 0): void {
    this._current = start & MAX_SALT;
  }
}

/**
 * Assign incrementing salts to items that don't already have one.
 *
 * Items with an explicit `salt` keep their value (the counter still advances
 * past them so there are no collisions when mixing explicit and auto salts).
 *
 * ```ts
 * assignSalts([{ name: "a" }, { name: "b", salt: 99 }, { name: "c" }]);
 * // → [{ name: "a", salt: 0 }, { name: "b", salt: 99 }, { name: "c", salt: 1 }]
 * ```
 */
export function assignSalts<T extends { salt?: number }>(
  items: T[],
  startSalt = 0,
): (T & { salt: number })[] {
  const counter = new MintSaltCounter(startSalt);
  return items.map((item) => ({
    ...item,
    salt: item.salt !== undefined ? item.salt : counter.next(),
  }));
}
