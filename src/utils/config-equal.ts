import type { DenshokanClientConfig } from "../types/config.js";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value) as object | null;
  return proto === Object.prototype || proto === null;
}

function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (!Object.is(a[key], b[key])) return false;
  }
  return true;
}

/**
 * Value-compares two client configs so an inline `config={{ ... }}` object
 * (a fresh reference every render) doesn't read as a config change.
 *
 * Every field is covered generically rather than by an explicit field list,
 * so fields added to `DenshokanClientConfig` later can't silently go stale:
 * primitives compare by value, plain objects (`rpcHeaders`, `fetch`, `ws`,
 * `health`) compare one level deep, and anything else (class instances like
 * `provider`, functions) compares by identity.
 *
 * An explicit `undefined` is equivalent to an absent key at every level,
 * matching how `resolveConfig` ignores undefined values when applying
 * defaults.
 */
export function configsEqual(a: DenshokanClientConfig, b: DenshokanClientConfig): boolean {
  if (a === b) return true;
  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(aRecord), ...Object.keys(bRecord)]);
  for (const key of keys) {
    const av = aRecord[key];
    const bv = bRecord[key];
    if (Object.is(av, bv)) continue;
    if (isPlainObject(av) && isPlainObject(bv) && shallowEqual(av, bv)) continue;
    return false;
  }
  return true;
}
