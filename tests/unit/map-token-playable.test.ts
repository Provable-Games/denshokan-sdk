import { describe, it, expect } from "vitest";
import { computeIsPlayable, mapToken } from "../../src/utils/mappers.js";

const MINTED_AT = "2026-06-11T17:45:39.000Z";
const MINTED_AT_MS = Date.parse(MINTED_AT);
const DAY = 86_400_000;

describe("computeIsPlayable", () => {
  const base = {
    mintedAtMs: MINTED_AT_MS,
    startDelaySecs: 0,
    endDelaySecs: 259200, // 3 days, like Greed
    gameOver: false,
  };

  it("is playable inside the [start, end) window", () => {
    expect(computeIsPlayable({ ...base, nowMs: MINTED_AT_MS + DAY })).toBe(true);
  });

  it("is playable immediately at mint when startDelay is 0", () => {
    expect(computeIsPlayable({ ...base, nowMs: MINTED_AT_MS })).toBe(true);
  });

  it("is not playable before the start time", () => {
    expect(
      computeIsPlayable({ ...base, startDelaySecs: 3600, nowMs: MINTED_AT_MS + 60_000 }),
    ).toBe(false);
  });

  it("is not playable once expired", () => {
    expect(computeIsPlayable({ ...base, nowMs: MINTED_AT_MS + 4 * DAY })).toBe(false);
  });

  it("never expires when endDelay is 0", () => {
    expect(
      computeIsPlayable({ ...base, endDelaySecs: 0, nowMs: MINTED_AT_MS + 365 * DAY }),
    ).toBe(true);
  });

  it("is not playable once the game is over", () => {
    expect(computeIsPlayable({ ...base, gameOver: true, nowMs: MINTED_AT_MS + DAY })).toBe(false);
  });

  it("is not playable with an unparseable mint time", () => {
    expect(computeIsPlayable({ ...base, mintedAtMs: NaN, nowMs: MINTED_AT_MS + DAY })).toBe(false);
  });
});

describe("mapToken isPlayable derivation", () => {
  // Use real-clock-relative fixtures (no fake timers) so this behaves the same
  // under vitest and `bun test`, which doesn't honor vitest's fake-timer API.
  const isoAgo = (ms: number) => new Date(Date.now() - ms).toISOString();

  // A live Greed run as returned by the token API: no isPlayable field, just
  // the lifecycle fields. Previously mapped to isPlayable=false forever.
  // Minted 1 day ago with a 3-day window ⇒ currently within [start, end).
  const liveRawGreedToken = () => ({
    tokenId: "1",
    gameId: 1,
    soulbound: true,
    gameOver: false,
    mintedAt: isoAgo(DAY),
    startDelay: 0,
    endDelay: 259200, // 3 days
    ownerAddress: "0x2c0936e4ccfc2da58f59511a93bb4e21554b3ff0e7690f4ca4672397abdba04",
  });

  it("derives isPlayable=true for a live, not-over run within its window", () => {
    expect(mapToken(liveRawGreedToken()).isPlayable).toBe(true);
  });

  it("derives isPlayable=false once the run is over", () => {
    expect(mapToken({ ...liveRawGreedToken(), gameOver: true }).isPlayable).toBe(false);
  });

  it("derives isPlayable=false after the run has expired", () => {
    // Minted 4 days ago with a 3-day window ⇒ expired.
    expect(mapToken({ ...liveRawGreedToken(), mintedAt: isoAgo(4 * DAY) }).isPlayable).toBe(false);
  });

  it("honors an explicit backend is_playable flag when present", () => {
    // Backend says not playable even though the window is open — respect it.
    expect(mapToken({ ...liveRawGreedToken(), is_playable: false }).isPlayable).toBe(false);
    expect(mapToken({ ...liveRawGreedToken(), isPlayable: true }).isPlayable).toBe(true);
  });
});
