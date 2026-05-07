#!/usr/bin/env node

/**
 * Denshokan Telegram score bot reference implementation.
 *
 * This file is intentionally dependency-free so it is easy for developers and
 * AI agents to copy, inspect, and adapt. It uses:
 * - Telegram long polling (`getUpdates`) for bot commands
 * - Denshokan WebSocket subscriptions for live score/game-over updates
 * - A small local JSON file for chat/account registrations
 *
 * Run from the repository root after building the SDK:
 *   TELEGRAM_BOT_TOKEN=123:abc node examples/telegram-score-bot.mjs
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { createDenshokanClient } from "@provable-games/denshokan-sdk";

const TELEGRAM_API = `https://api.telegram.org/bot${requiredEnv("TELEGRAM_BOT_TOKEN")}`;
const REGISTRATIONS_FILE = process.env.REGISTRATIONS_FILE ?? ".telegram-score-bot-registrations.json";

const client = createDenshokanClient({
  chain: process.env.DENSHOKAN_CHAIN ?? "mainnet",
  apiUrl: process.env.DENSHOKAN_API_URL,
  wsUrl: process.env.DENSHOKAN_WS_URL,
  rpcUrl: process.env.DENSHOKAN_RPC_URL,
  denshokanAddress: process.env.DENSHOKAN_ADDRESS,
  registryAddress: process.env.DENSHOKAN_REGISTRY_ADDRESS,
  viewerAddress: process.env.DENSHOKAN_VIEWER_ADDRESS,
});

let registrations = await loadRegistrations();
let unsubscribeDenshokan = null;
let stopping = false;

client.onWsConnectionChange((connected) => {
  console.log(`Denshokan WebSocket ${connected ? "connected" : "disconnected"}`);
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await telegram("deleteWebhook", { drop_pending_updates: false });
refreshDenshokanSubscription();
console.log("Telegram score bot is running.");
await pollTelegram();

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is required.`);
    process.exit(1);
  }
  return value;
}

async function loadRegistrations() {
  if (!existsSync(REGISTRATIONS_FILE)) return { accounts: {} };

  try {
    const raw = await readFile(REGISTRATIONS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return sanitizeRegistrations(parsed);
  } catch (error) {
    console.warn(`Could not load ${REGISTRATIONS_FILE}; starting with no registrations: ${formatError(error)}`);
    return { accounts: {} };
  }
}

// Persisted shape:
// {
//   "accounts": {
//     "0xnormalizedOwner": {
//       "inputAddress": "0xaddressAsRegistered",
//       "chatIds": ["123456789"]
//     }
//   }
// }
function sanitizeRegistrations(value) {
  const output = { accounts: {} };
  if (!value || typeof value !== "object" || !value.accounts || typeof value.accounts !== "object") {
    return output;
  }

  for (const [owner, entry] of Object.entries(value.accounts)) {
    let normalizedOwner;
    try {
      normalizedOwner = normalizeAddress(owner);
    } catch {
      continue;
    }

    if (!entry || typeof entry !== "object" || !Array.isArray(entry.chatIds)) {
      continue;
    }

    const chatIds = [...new Set(entry.chatIds.map(String).filter(Boolean))];
    if (chatIds.length === 0) continue;

    output.accounts[normalizedOwner] = {
      inputAddress: typeof entry.inputAddress === "string" ? entry.inputAddress : normalizedOwner,
      chatIds,
    };
  }

  return output;
}

async function saveRegistrations() {
  const dir = dirname(REGISTRATIONS_FILE);
  if (dir && dir !== ".") await mkdir(dir, { recursive: true });

  const tmpFile = `${REGISTRATIONS_FILE}.tmp`;
  await writeFile(tmpFile, `${JSON.stringify(registrations, null, 2)}\n`);
  await rename(tmpFile, REGISTRATIONS_FILE);
}

function refreshDenshokanSubscription() {
  if (unsubscribeDenshokan) {
    unsubscribeDenshokan();
    unsubscribeDenshokan = null;
  }

  const entries = Object.entries(registrations.accounts)
    .filter(([, entry]) => entry.chatIds.length > 0);

  const owners = [
    ...new Set(
      entries.flatMap(([owner, entry]) => [owner, entry.inputAddress].filter(Boolean)),
    ),
  ];

  if (owners.length === 0) {
    console.log("No registered accounts. Waiting for /register commands.");
    return;
  }

  client.connect();
  unsubscribeDenshokan = client.subscribe(
    { channels: ["scores", "game_over"], owners },
    (message) => {
      void handleDenshokanMessage(message);
    },
  );
  console.log(`Subscribed to score updates for ${entries.length} account(s).`);
}

async function handleDenshokanMessage(message) {
  if (message.channel !== "scores" && message.channel !== "game_over") return;

  const event = mapScoreLikeEvent(message.data);
  if (!event.ownerAddress) return;

  let owner;
  try {
    owner = normalizeAddress(event.ownerAddress);
  } catch {
    return;
  }

  const registration = registrations.accounts[owner];
  if (!registration) return;

  const text = message.channel === "game_over"
    ? formatGameOver(event, owner)
    : formatScoreUpdate(event, owner);

  const results = await Promise.allSettled(
    registration.chatIds.map((chatId) => sendMessage(chatId, text)),
  );
  for (const result of results) {
    if (result.status === "rejected") {
      console.error(`Telegram send failed: ${formatError(result.reason)}`);
    }
  }
}

// WebSocket payloads currently arrive as snake_case from the API, but this
// accepts camelCase too so the example keeps working if the SDK mapper layer is
// reused before messages reach this script.
function mapScoreLikeEvent(data) {
  const raw = data && typeof data === "object" ? data : {};
  return {
    tokenId: String(raw.token_id ?? raw.tokenId ?? ""),
    gameId: Number(raw.game_id ?? raw.gameId ?? 0),
    score: Number(raw.score ?? 0),
    ownerAddress: String(raw.owner_address ?? raw.ownerAddress ?? ""),
    playerName: String(raw.player_name ?? raw.playerName ?? ""),
    completedAllObjectives: Boolean(raw.completed_all_objectives ?? raw.completedAllObjectives),
  };
}

// Telegram long polling. `deleteWebhook` is called at startup because Telegram
// allows either webhooks or polling for a bot, not both.
async function pollTelegram() {
  let offset;

  while (!stopping) {
    try {
      const result = await telegram("getUpdates", {
        timeout: 50,
        offset,
        allowed_updates: ["message"],
      });

      for (const update of result) {
        offset = update.update_id + 1;
        if (update.message?.text) {
          await handleTelegramMessage(update.message);
        }
      }
    } catch (error) {
      console.error(`Telegram polling failed: ${formatError(error)}`);
      await sleep(2000);
    }
  }
}

async function handleTelegramMessage(message) {
  const chatId = String(message.chat.id);
  const text = message.text.trim();
  const [rawCommand, ...args] = text.split(/\s+/);
  const command = rawCommand.split("@")[0].toLowerCase();

  if (command === "/start" || command === "/help") {
    await sendMessage(chatId, helpText());
    return;
  }

  if (command === "/register") {
    await registerAccount(chatId, args[0]);
    return;
  }

  if (command === "/unregister") {
    await unregisterAccount(chatId, args[0]);
    return;
  }

  if (command === "/accounts") {
    await listAccounts(chatId);
    return;
  }

  if (command === "/status") {
    await sendLatestStatus(chatId);
  }
}

async function registerAccount(chatId, inputAddress) {
  if (!inputAddress) {
    await sendMessage(chatId, "Usage: /register 0xACCOUNT_ADDRESS");
    return;
  }

  let owner;
  try {
    owner = normalizeAddress(inputAddress);
  } catch {
    await sendMessage(chatId, "That does not look like a Starknet account address.");
    return;
  }

  const entry = registrations.accounts[owner] ?? { inputAddress, chatIds: [] };
  if (!entry.chatIds.includes(chatId)) entry.chatIds.push(chatId);
  registrations.accounts[owner] = entry;
  await saveRegistrations();
  refreshDenshokanSubscription();

  await sendMessage(chatId, `Registered ${shortHex(owner)} for live score updates.`);
}

async function unregisterAccount(chatId, inputAddress) {
  if (inputAddress) {
    let owner;
    try {
      owner = normalizeAddress(inputAddress);
    } catch {
      await sendMessage(chatId, "That does not look like a Starknet account address.");
      return;
    }

    const entry = registrations.accounts[owner];
    if (entry) {
      entry.chatIds = entry.chatIds.filter((id) => id !== chatId);
      if (entry.chatIds.length === 0) delete registrations.accounts[owner];
    }
    await saveRegistrations();
    refreshDenshokanSubscription();
    await sendMessage(chatId, `Unregistered ${shortHex(owner)}.`);
    return;
  }

  let removed = 0;
  for (const [owner, entry] of Object.entries(registrations.accounts)) {
    const before = entry.chatIds.length;
    entry.chatIds = entry.chatIds.filter((id) => id !== chatId);
    removed += before - entry.chatIds.length;
    if (entry.chatIds.length === 0) delete registrations.accounts[owner];
  }

  await saveRegistrations();
  refreshDenshokanSubscription();
  await sendMessage(chatId, removed > 0 ? "Unregistered this chat from all accounts." : "This chat has no registered accounts.");
}

async function listAccounts(chatId) {
  const owners = chatOwners(chatId);
  if (owners.length === 0) {
    await sendMessage(chatId, "No accounts registered. Use /register 0xACCOUNT_ADDRESS.");
    return;
  }

  await sendMessage(chatId, `Registered accounts:\n${owners.map((owner) => `- ${owner}`).join("\n")}`);
}

async function sendLatestStatus(chatId) {
  const owners = chatOwners(chatId);
  if (owners.length === 0) {
    await sendMessage(chatId, "No accounts registered. Use /register 0xACCOUNT_ADDRESS.");
    return;
  }

  const lines = [];
  for (const owner of owners) {
    try {
      const result = await client.getPlayerTokens(owner, {
        sort: { field: "lastUpdatedAt", direction: "desc" },
        limit: 1,
      });
      const token = result.data[0];
      if (!token) {
        lines.push(`${shortHex(owner)}\nNo tokens found.`);
      } else {
        lines.push([
          shortHex(owner),
          `Latest token: ${shortHex(token.tokenId)}`,
          `Game ID: ${token.gameId}`,
          `Score: ${token.score}`,
          `Last updated: ${token.lastUpdatedAt}`,
        ].join("\n"));
      }
    } catch (error) {
      lines.push(`${shortHex(owner)}\nStatus lookup failed: ${formatError(error)}`);
    }
  }

  await sendMessage(chatId, lines.join("\n\n"));
}

function chatOwners(chatId) {
  return Object.entries(registrations.accounts)
    .filter(([, entry]) => entry.chatIds.includes(chatId))
    .map(([owner]) => owner);
}

function formatScoreUpdate(event, owner) {
  return [
    "Score update",
    `Account: ${shortHex(owner)}`,
    event.playerName ? `Player: ${event.playerName}` : null,
    `Game ID: ${event.gameId}`,
    `Token ID: ${shortHex(event.tokenId)}`,
    `Score: ${event.score}`,
  ].filter(Boolean).join("\n");
}

function formatGameOver(event, owner) {
  return [
    "Game over",
    `Account: ${shortHex(owner)}`,
    event.playerName ? `Player: ${event.playerName}` : null,
    `Game ID: ${event.gameId}`,
    `Token ID: ${shortHex(event.tokenId)}`,
    `Final score: ${event.score}`,
    event.completedAllObjectives ? "Completed all objectives: yes" : null,
  ].filter(Boolean).join("\n");
}

function helpText() {
  return [
    "Denshokan live score bot",
    "",
    "/register 0xACCOUNT_ADDRESS - post live score updates for an account here",
    "/unregister 0xACCOUNT_ADDRESS - stop one account",
    "/unregister - stop all accounts in this chat",
    "/accounts - list registered accounts",
    "/status - show each account's most recently updated token",
  ].join("\n");
}

function normalizeAddress(value) {
  if (typeof value !== "string" || !/^0[xX][0-9a-fA-F]+$/.test(value)) {
    throw new Error("Invalid address");
  }
  return `0x${BigInt(value).toString(16)}`;
}

function shortHex(value) {
  if (!value || value.length <= 18) return value;
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

async function telegram(method, body) {
  const response = await fetch(`${TELEGRAM_API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.description ?? `Telegram ${method} failed`);
  }
  return payload.result;
}

async function sendMessage(chatId, text) {
  await telegram("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function shutdown() {
  if (stopping) return;
  stopping = true;
  console.log("Shutting down...");
  if (unsubscribeDenshokan) unsubscribeDenshokan();
  client.disconnect();
}
