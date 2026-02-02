export function normalizeAddress(address: string): string {
  const stripped = address.replace(/^0x0*/, "");
  return "0x" + stripped.padStart(64, "0");
}
