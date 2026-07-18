import { describe, it, expect, vi, afterEach } from "vitest";
import { DenshokanClient } from "../../src/client.js";

// Regression: getTokens must enforce the game-STATE filters (`playable` / `gameOver`)
// on the rows it returns even when the datasource doesn't. The `/tokens` API endpoint
// IGNORES a playable flag entirely, so a `{ playable: true }` query used to come back
// unfiltered — e.g. AliveBeastGamesReader counted played-out games as "alive" and
// permanently blocked claim-on-play. See the safety net in client._getTokensImpl.

/** A raw API token row with explicit state booleans. */
function row(tokenId: string, gameOver: boolean, isPlayable: boolean) {
  return {
    tokenId,
    game_id: 1,
    owner: "0xabc",
    minted_at: "2026-07-18T10:00:00.000Z",
    gameOver,
    isPlayable,
  };
}

/** An ok fetch returning an UNFILTERED page (as the real API does for playable). */
function okPage(data: unknown[]) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ data, total: data.length }),
  };
}

const originalFetch = globalThis.fetch;

function makeClient(data: unknown[]) {
  globalThis.fetch = vi.fn().mockResolvedValue(okPage(data)) as unknown as typeof fetch;
  // primarySource defaults to "api" → getTokens hits apiGetTokens (our mocked fetch).
  return new DenshokanClient({ chain: "mainnet", apiUrl: "http://api.test" });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("getTokens — game-state filter safety net", () => {
  it("drops game-over/unplayable rows the API returns for a { playable: true } query", async () => {
    // The API ignores `playable` and returns a mixed page: 1 genuinely alive, 2 dead.
    const client = makeClient([
      row("0x1", false, true), // alive
      row("0x2", true, false), // game over
      row("0x3", true, false), // game over
    ]);
    try {
      const res = await client.getTokens({ owner: "0xabc", playable: true });
      expect(res.data.map((t) => t.tokenId)).toEqual(["0x1"]);
      expect(res.data.every((t) => t.isPlayable)).toBe(true);
      expect(res.total).toBe(1); // total tightened to the filtered count
    } finally {
      client.disconnect();
    }
  });

  it("enforces { gameOver: false } on an unfiltered page", async () => {
    const client = makeClient([
      row("0x1", false, true),
      row("0x2", true, false),
      row("0x3", false, false), // not over, not playable (unstarted) — still not gameOver
    ]);
    try {
      const res = await client.getTokens({ owner: "0xabc", gameOver: false });
      expect(res.data.map((t) => t.tokenId).sort()).toEqual(["0x1", "0x3"]);
      expect(res.data.every((t) => t.gameOver === false)).toBe(true);
    } finally {
      client.disconnect();
    }
  });

  it("leaves an already-correct page untouched (idempotent)", async () => {
    const client = makeClient([row("0x1", false, true), row("0x2", false, true)]);
    try {
      const res = await client.getTokens({ owner: "0xabc", playable: true });
      expect(res.data).toHaveLength(2);
      expect(res.total).toBe(2);
    } finally {
      client.disconnect();
    }
  });
});
