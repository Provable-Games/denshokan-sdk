/**
 * Integration test: exercises SDK RPC methods against live Starknet sepolia.
 * Run: npx tsx scripts/test-rpc.ts
 */
import { createDenshokanClient } from "../src/index.js";

const API_URL = "https://denshokan-api-production.up.railway.app";
const GAME_ADDRESS = "0x7bb56e8f0725cb2ad03037e4383f7d531c46e27e54be869589a8f0616fd9900";
const TOKEN_ID = "295716915005308580247753821737990710711541918677276362081826313863169";
const PLAYER_ADDRESS = "0x77b8ed8356a7c1f0903fc4ba6e15f9b09cf437ce04f21b2cbf32dc2790183d0";

const client = createDenshokanClient({
  apiUrl: API_URL,
  chain: "sepolia",
  primarySource: "rpc",
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

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function run() {
  console.log("\n=== SDK RPC Integration Tests ===\n");
  console.log("Chain: sepolia");
  console.log("RPC: https://api.cartridge.gg/x/starknet/sepolia\n");

  // ── ERC721 ─────────────────────────────────────────────

  console.log("ERC721:");

  await test("name() returns contract name", async () => {
    const name = await client.name();
    assert(typeof name === "string", "name should be string");
    assert(name.length > 0, "name should not be empty");
    console.log(`      → "${name}"`);
  });

  await test("symbol() returns contract symbol", async () => {
    const symbol = await client.symbol();
    assert(typeof symbol === "string", "symbol should be string");
    assert(symbol.length > 0, "symbol should not be empty");
    console.log(`      → "${symbol}"`);
  });

  await test("balanceOf(address) returns bigint", async () => {
    const balance = await client.balanceOf(PLAYER_ADDRESS);
    assert(typeof balance === "bigint", "balance should be bigint");
    assert(balance >= 0n, "balance should be non-negative");
    console.log(`      → ${balance}`);
  });

  await test("ownerOf(tokenId) returns address", async () => {
    const owner = await client.ownerOf(TOKEN_ID);
    assert(typeof owner === "string", "owner should be string");
    assert(owner.startsWith("0x"), "owner should be hex address");
    console.log(`      → ${owner.slice(0, 12)}...`);
  });

  await test("tokenUri(tokenId) returns URI string", async () => {
    const uri = await client.tokenUri(TOKEN_ID);
    assert(typeof uri === "string", "uri should be string");
    console.log(`      → ${uri.slice(0, 60)}${uri.length > 60 ? "..." : ""}`);
  });

  // ── ERC721Enumerable ───────────────────────────────────

  console.log("\nERC721Enumerable:");

  await test("totalSupply() returns bigint", async () => {
    const supply = await client.totalSupply();
    assert(typeof supply === "bigint", "supply should be bigint");
    assert(supply > 0n, "supply should be positive");
    console.log(`      → ${supply}`);
  });

  await test("tokenByIndex(0) returns a token ID", async () => {
    const tokenId = await client.tokenByIndex(0n);
    assert(typeof tokenId === "string", "tokenId should be string");
    console.log(`      → ${tokenId.slice(0, 20)}...`);
  });

  await test("tokenOfOwnerByIndex(address, 0) returns a token ID", async () => {
    const tokenId = await client.tokenOfOwnerByIndex(PLAYER_ADDRESS, 0n);
    assert(typeof tokenId === "string", "tokenId should be string");
    console.log(`      → ${tokenId.slice(0, 20)}...`);
  });

  await test("enumerateTokenIds({ limit: 2 }) returns token IDs", async () => {
    const ids = await client.enumerateTokenIds({ limit: 2 });
    assert(Array.isArray(ids), "should be an array");
    assert(ids.length > 0, "should have at least one token ID");
    console.log(`      → [${ids.map((id) => id.slice(0, 12) + "...").join(", ")}]`);
  });

  // ── Batch Metadata (Denshokan contract) ────────────────

  console.log("\nDenshokan Batch Metadata:");

  await test("tokenMetadata(tokenId) returns metadata", async () => {
    const meta = await client.tokenMetadata(TOKEN_ID);
    assert(typeof meta === "object", "should be an object");
    assert(typeof meta.gameId === "number", "gameId should be number");
    assert(typeof meta.settingsId === "number", "settingsId should be number");
    console.log(`      → gameId=${meta.gameId}, settingsId=${meta.settingsId}`);
  });

  await test("tokenMetadataBatch([tokenId]) returns array", async () => {
    const metas = await client.tokenMetadataBatch([TOKEN_ID]);
    assert(Array.isArray(metas), "should be an array");
    assert(metas.length === 1, "should have 1 result");
  });

  await test("tokenMutableState(tokenId) returns mutable state", async () => {
    const state = await client.tokenMutableState(TOKEN_ID);
    assert(typeof state === "object", "should be an object");
    assert(typeof state.gameOver === "boolean", "gameOver should be boolean");
    console.log(`      → gameOver=${state.gameOver}`);
  });

  await test("isPlayable(tokenId) returns boolean", async () => {
    const playable = await client.isPlayable(TOKEN_ID);
    assert(typeof playable === "boolean", "should be boolean");
    console.log(`      → ${playable}`);
  });

  await test("settingsId(tokenId) returns number", async () => {
    const id = await client.settingsId(TOKEN_ID);
    assert(typeof id === "number", "should be number");
    console.log(`      → ${id}`);
  });

  await test("playerName(tokenId) returns string", async () => {
    const name = await client.playerName(TOKEN_ID);
    assert(typeof name === "string", "should be string");
    console.log(`      → "${name}"`);
  });

  await test("objectiveId(tokenId) returns number", async () => {
    const id = await client.objectiveId(TOKEN_ID);
    assert(typeof id === "number", "should be number");
    console.log(`      → ${id}`);
  });

  await test("mintedBy(tokenId) returns string", async () => {
    const minter = await client.mintedBy(TOKEN_ID);
    assert(typeof minter === "string", "should be string");
    console.log(`      → ${minter.slice(0, 12)}...`);
  });

  await test("isSoulbound(tokenId) returns boolean", async () => {
    const soulbound = await client.isSoulbound(TOKEN_ID);
    assert(typeof soulbound === "boolean", "should be boolean");
    console.log(`      → ${soulbound}`);
  });

  await test("rendererAddress(tokenId) returns address", async () => {
    const addr = await client.rendererAddress(TOKEN_ID);
    assert(typeof addr === "string", "should be string");
    console.log(`      → ${addr.slice(0, 12)}...`);
  });

  await test("tokenGameAddress(tokenId) returns address", async () => {
    const addr = await client.tokenGameAddress(TOKEN_ID);
    assert(typeof addr === "string", "should be string");
    assert(addr.startsWith("0x"), "should be hex");
    console.log(`      → ${addr.slice(0, 12)}...`);
  });

  // ── Registry Contract ──────────────────────────────────

  console.log("\nRegistry:");

  await test("gameMetadata(gameId) returns metadata", async () => {
    const meta = await client.gameMetadata(1);
    assert(typeof meta === "object", "should be an object");
    assert(meta.gameId === 1, "gameId should be 1");
    assert(typeof meta.name === "string", "name should be string");
    assert(typeof meta.contractAddress === "string", "contractAddress should be string");
    console.log(`      → name="${meta.name}", contract=${meta.contractAddress.slice(0, 12)}...`);
  });

  await test("gameAddress(gameId) returns address", async () => {
    const addr = await client.gameAddress(1);
    assert(typeof addr === "string", "should be string");
    assert(addr.startsWith("0x"), "should be hex");
    console.log(`      → ${addr.slice(0, 20)}...`);
  });

  // ── Game Contract (score & state) ──────────────────────

  console.log("\nGame Contract (score & state):");

  await test("score(tokenId, gameAddress) returns bigint", async () => {
    const s = await client.score(TOKEN_ID, GAME_ADDRESS);
    assert(typeof s === "bigint", "score should be bigint");
    console.log(`      → ${s}`);
  });

  await test("scoreBatch([tokenId], gameAddress) returns array", async () => {
    const scores = await client.scoreBatch([TOKEN_ID], GAME_ADDRESS);
    assert(Array.isArray(scores), "should be an array");
    assert(scores.length === 1, "should have 1 result");
    assert(typeof scores[0] === "bigint", "each score should be bigint");
  });

  await test("gameOver(tokenId, gameAddress) returns boolean", async () => {
    const over = await client.gameOver(TOKEN_ID, GAME_ADDRESS);
    assert(typeof over === "boolean", "should be boolean");
    console.log(`      → ${over}`);
  });

  await test("gameOverBatch([tokenId], gameAddress) returns array", async () => {
    const results = await client.gameOverBatch([TOKEN_ID], GAME_ADDRESS);
    assert(Array.isArray(results), "should be an array");
    assert(results.length === 1, "should have 1 result");
  });

  // ── Game Contract (objectives) ─────────────────────────

  console.log("\nGame Contract (objectives):");

  await test("objectivesCount(gameAddress) returns number", async () => {
    const count = await client.objectivesCount(GAME_ADDRESS);
    assert(typeof count === "number", "should be number");
    assert(count >= 0, "should be non-negative");
    console.log(`      → ${count}`);
  });

  await test("objectiveExists(1, gameAddress) returns boolean", async () => {
    const exists = await client.objectiveExists(1, GAME_ADDRESS);
    assert(typeof exists === "boolean", "should be boolean");
    console.log(`      → ${exists}`);
  });

  // ── Game Contract (settings) ───────────────────────────

  console.log("\nGame Contract (settings):");

  await test("settingsCount(gameAddress) returns number", async () => {
    const count = await client.settingsCount(GAME_ADDRESS);
    assert(typeof count === "number", "should be number");
    assert(count >= 0, "should be non-negative");
    console.log(`      → ${count}`);
  });

  await test("settingsExists(1, gameAddress) returns boolean", async () => {
    const exists = await client.settingsExists(1, GAME_ADDRESS);
    assert(typeof exists === "boolean", "should be boolean");
    console.log(`      → ${exists}`);
  });

  // ── Utilities ──────────────────────────────────────────

  console.log("\nUtilities:");

  await test("decodeTokenId(tokenId) decodes packed fields", async () => {
    const decoded = client.decodeTokenId(TOKEN_ID);
    assert(typeof decoded.gameId === "number", "gameId should be number");
    assert(typeof decoded.settingsId === "number", "settingsId should be number");
    assert(typeof decoded.objectiveId === "number", "objectiveId should be number");
    assert(decoded.mintedAt instanceof Date, "mintedAt should be Date");
    assert(typeof decoded.soulbound === "boolean", "soulbound should be boolean");
    console.log(`      → gameId=${decoded.gameId}, settingsId=${decoded.settingsId}, mintedAt=${decoded.mintedAt.toISOString()}`);
  });

  await test("decodeToken(tokenId) returns CoreToken", async () => {
    const token = client.decodeToken(TOKEN_ID);
    assert(typeof token.tokenId === "string", "tokenId should be string");
    assert(typeof token.gameId === "number", "gameId should be number");
    console.log(`      → tokenId=${token.tokenId.slice(0, 12)}..., gameId=${token.gameId}`);
  });

  // ── Fallback: getToken with RPC primary ────────────────

  console.log("\nFallback (RPC-first mode):");

  await test("getToken(tokenId) builds token from RPC", async () => {
    const token = await client.getToken(TOKEN_ID);
    assert(typeof token.tokenId === "string", "tokenId should be string");
    assert(typeof token.gameId === "number", "gameId should be number");
    assert(typeof token.owner === "string", "owner should be string");
    assert(typeof token.gameOver === "boolean", "gameOver should be boolean");
    assert(typeof token.playerName === "string", "playerName should be string");
    assert(typeof token.isPlayable === "boolean", "isPlayable should be boolean");
    assert(typeof token.gameAddress === "string", "gameAddress should be string");
    console.log(`      → owner=${token.owner.slice(0, 12)}..., gameOver=${token.gameOver}, playerName="${token.playerName}"`);
  });

  // ── Summary ────────────────────────────────────────────

  console.log(`\n${"=".repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log(`${"=".repeat(40)}\n`);

  client.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
