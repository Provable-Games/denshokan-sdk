/**
 * Integration test: exercises every SDK API method against the live server.
 * Run: npx tsx scripts/test-api.ts
 */
import { createDenshokanClient } from "../src/index.js";

const API_URL = "https://denshokan-api-sepolia.up.railway.app";
const GAME_ADDRESS = "0x7bb56e8f0725cb2ad03037e4383f7d531c46e27e54be869589a8f0616fd9900";
const TOKEN_ID = "295716915005308580247753821737990710711541918677276362081826313863169";
const PLAYER_ADDRESS = "0x77b8ed8356a7c1f0903fc4ba6e15f9b09cf437ce04f21b2cbf32dc2790183d0";
const MINTER_ID = "1";

const client = createDenshokanClient({
  apiUrl: API_URL,
  primarySource: "api",
  // Dummy values to prevent any RPC calls
  rpcUrl: "http://localhost:1",
  chain: "sepolia",
});

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err: unknown) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ✗ ${name}`);
    console.log(`    ${msg}`);
  }
}

async function run() {
  console.log("\n=== SDK API Integration Tests ===\n");
  console.log(`API: ${API_URL}\n`);

  // ── Games ──────────────────────────────────────────────

  console.log("Games:");

  await test("getGames() returns paginated list", async () => {
    const result = await client.getGames({ limit: 10 });
    assert(Array.isArray(result.data), "data should be an array");
    assert(typeof result.total === "number", "total should be a number");
    assert(result.data.length > 0, "should have at least one game");
    const game = result.data[0];
    assert(typeof game.gameId === "number", "game.gameId should be number");
    assert(typeof game.name === "string", "game.name should be string");
    assert(typeof game.contractAddress === "string", "game.contractAddress should be string");
  });

  await test("getGame(gameAddress) returns single game", async () => {
    const game = await client.getGame(GAME_ADDRESS);
    assert(game.gameId === 1, `gameId should be 1, got ${game.gameId}`);
    assert(game.name === "Number Guess", `name should be 'Number Guess', got '${game.name}'`);
    assert(typeof game.contractAddress === "string", "contractAddress should be string");
  });

  await test("getGameObjectives(gameAddress) returns array", async () => {
    const objectives = await client.getGameObjectives(GAME_ADDRESS);
    assert(Array.isArray(objectives), "should be an array");
  });

  await test("getGameSettings(gameAddress) returns array", async () => {
    const settings = await client.getGameSettings(GAME_ADDRESS);
    assert(Array.isArray(settings), "should be an array");
  });

  // ── Tokens ─────────────────────────────────────────────

  console.log("\nTokens:");

  await test("getTokens() returns paginated list", async () => {
    const result = await client.getTokens({ limit: 5 });
    assert(Array.isArray(result.data), "data should be an array");
    assert(typeof result.total === "number", "total should be a number");
    if (result.data.length > 0) {
      const token = result.data[0];
      assert(typeof token.tokenId === "string", "tokenId should be string");
      assert(typeof token.gameId === "number", "gameId should be number");
      assert(typeof token.owner === "string", "owner should be string");
    }
  });

  await test("getTokens({ gameId }) filters by game", async () => {
    const result = await client.getTokens({ gameId: 1, limit: 5 });
    assert(Array.isArray(result.data), "data should be an array");
    for (const token of result.data) {
      assert(token.gameId === 1, `all tokens should have gameId=1, got ${token.gameId}`);
    }
  });

  await test("getToken(tokenId) returns single token", async () => {
    const token = await client.getToken(TOKEN_ID);
    assert(typeof token.tokenId === "string", "tokenId should be string");
    assert(typeof token.owner === "string", "owner should be string");
    assert(typeof token.gameOver === "boolean", "gameOver should be boolean");
  });

  await test("getTokenScores(tokenId) returns score history", async () => {
    const scores = await client.getTokenScores(TOKEN_ID);
    assert(Array.isArray(scores), "should be an array");
  });

  // ── Players ────────────────────────────────────────────

  console.log("\nPlayers:");

  await test("getPlayerTokens(address) returns paginated tokens", async () => {
    const result = await client.getPlayerTokens(PLAYER_ADDRESS);
    assert(Array.isArray(result.data), "data should be an array");
    assert(typeof result.total === "number", "total should be a number");
  });

  await test("getPlayerStats(address) returns stats", async () => {
    const stats = await client.getPlayerStats(PLAYER_ADDRESS);
    assert(typeof stats.address === "string", "address should be string");
    assert(typeof stats.totalTokens === "number", "totalTokens should be number");
    assert(typeof stats.gamesPlayed === "number", "gamesPlayed should be number");
    assert(typeof stats.activeGames === "number", "activeGames should be number");
    assert(typeof stats.completedGames === "number", "completedGames should be number");
    assert(typeof stats.totalScore === "string", "totalScore should be string");
    // Verify old fields are gone
    assert(!("activeTokens" in stats), "should NOT have activeTokens");
    assert(!("highestScore" in stats), "should NOT have highestScore");
  });

  // ── Minters ────────────────────────────────────────────

  console.log("\nMinters:");

  await test("getMinters() returns paginated list", async () => {
    const result = await client.getMinters({ limit: 10 });
    assert(Array.isArray(result.data), "data should be an array");
    assert(typeof result.total === "number", "total should be a number");
    if (result.data.length > 0) {
      const minter = result.data[0];
      assert(typeof minter.minterId === "string", "minterId should be string");
      assert(typeof minter.contractAddress === "string", "contractAddress should be string");
      assert(typeof minter.blockNumber === "string", "blockNumber should be string");
      // Verify old fields are gone
      assert(!("gameId" in minter), "should NOT have gameId");
      assert(!("active" in minter), "should NOT have active");
      assert(!("address" in minter), "should NOT have address (use contractAddress)");
    }
  });

  await test("getMinter(minterId) returns single minter", async () => {
    const minter = await client.getMinter(MINTER_ID);
    assert(minter.minterId === "1", `minterId should be '1', got '${minter.minterId}'`);
    assert(typeof minter.contractAddress === "string", "contractAddress should be string");
  });

  // ── Summary ────────────────────────────────────────────

  console.log(`\n${"=".repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log(`${"=".repeat(40)}\n`);

  client.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
