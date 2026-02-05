export function normalizeAddress(address: string): string {
  const stripped = address.replace(/^0x0*/, "");
  return "0x" + stripped.padStart(64, "0");
}

/**
 * Convert a BigInt or hex/decimal string to a normalized 0x-prefixed hex address.
 * Use this for RPC results which may return BigInt values.
 */
export function toHexAddress(value: unknown): string {
  if (typeof value === "bigint") {
    return "0x" + value.toString(16).padStart(64, "0");
  }
  const str = String(value);
  // If already hex, normalize it
  if (str.startsWith("0x")) {
    const stripped = str.slice(2).replace(/^0+/, "");
    return "0x" + stripped.padStart(64, "0");
  }
  // Decimal string - convert to hex
  try {
    const bigVal = BigInt(str);
    return "0x" + bigVal.toString(16).padStart(64, "0");
  } catch {
    return "0x" + "0".repeat(64);
  }
}

/**
 * Convert a BigInt or hex/decimal string to a 0x-prefixed hex token ID.
 * Unlike addresses, token IDs don't need to be padded to 64 characters.
 */
export function toHexTokenId(value: unknown): string {
  if (value === null || value === undefined) {
    return "0x0";
  }
  if (typeof value === "bigint") {
    return "0x" + value.toString(16);
  }
  const str = String(value);
  // If already hex, return as-is (normalized)
  if (str.startsWith("0x")) {
    return str;
  }
  // Decimal string - convert to hex
  try {
    const bigVal = BigInt(str);
    return "0x" + bigVal.toString(16);
  } catch {
    return "0x0";
  }
}
