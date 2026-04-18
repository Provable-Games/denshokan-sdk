# @provable-games/denshokan-sdk

TypeScript SDK for [Denshokan](https://github.com/Provable-Games/denshokan) — query game tokens via REST API and Starknet RPC with automatic fallback.

## Features

- **Dual data source** — API-first with automatic RPC fallback when the indexer is unavailable
- **Batch-first RPC** — All batch contract endpoints are primary; single-item methods delegate to batch internally
- **Health monitoring** — Background `ConnectionStatus` service tracks API/RPC availability and auto-switches modes
- **React hooks** — Provider, data hooks, WebSocket subscriptions, and RPC hooks out of the box
- **Packed token ID decoder** — Decode all 13 fields from Denshokan's felt252-packed token IDs
- **WebSocket subscriptions** — Real-time `tokens`, `scores`, `game_over`, and `mints` channels with auto-reconnect
- **ESM + CJS** — Dual build with full TypeScript declarations
- **camelCase types** — All public types use camelCase field names (`tokenId`, `gameId`, `playerName`)

## Install

```bash
npm install @provable-games/denshokan-sdk
# or
pnpm add @provable-games/denshokan-sdk
```

**Peer dependencies** (install if you need their features):

```bash
npm install starknet    # Required for RPC calls
npm install react       # Required for React hooks
```

## Quick Start

### Basic Client

```ts
import { createDenshokanClient } from "@provable-games/denshokan-sdk";

const client = createDenshokanClient({
  chain: "mainnet",
  denshokanAddress: "0x...",
  registryAddress: "0x...",
  apiUrl: "https://your-api.example.com",
});

// Fetch games from API
const games = await client.getGames();
console.log(games[0].gameId, games[0].name);

// Fetch a token (API with automatic RPC fallback)
const token = await client.getToken("12345");
console.log(token.tokenId, token.playerName, token.isPlayable);

// Batch RPC call
const metadata = await client.tokenMetadataBatch(["123", "456", "789"]);

// Decode a packed token ID
const decoded = client.decodeTokenId("98765");
console.log(decoded.gameId, decoded.settingsId, decoded.soulbound);
```

### React

```tsx
import { DenshokanProvider, useGames, useToken } from "@provable-games/denshokan-sdk/react";

function App() {
  return (
    <DenshokanProvider
      config={{
        chain: "mainnet",
        denshokanAddress: "0x...",
        registryAddress: "0x...",
        apiUrl: "https://your-api.example.com",
      }}
    >
      <GameList />
    </DenshokanProvider>
  );
}

function GameList() {
  const { data: games, isLoading, error } = useGames();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {games?.map((game) => (
        <li key={game.gameId}>{game.name}</li>
      ))}
    </ul>
  );
}
```

### WebSocket Subscriptions

```tsx
import { useSubscription } from "@provable-games/denshokan-sdk/react";

function ScoreFeed({ gameId }: { gameId: number }) {
  useSubscription(
    ["scores", "game_over"],
    (message) => {
      console.log("Event:", message.channel, message.data);
    },
    [gameId],
  );

  return <div>Listening for score updates...</div>;
}
```

### RPC Hooks

```tsx
import { useBalanceOf, useScoreBatch } from "@provable-games/denshokan-sdk/react";

function PlayerBalance({ address }: { address: string }) {
  const { data: balance } = useBalanceOf(address);
  return <div>Tokens owned: {balance?.toString()}</div>;
}

function Scores({ tokenIds, gameAddress }: { tokenIds: string[]; gameAddress: string }) {
  const { data: scores } = useScoreBatch(tokenIds, gameAddress);
  return (
    <ul>
      {scores?.map((score, i) => (
        <li key={tokenIds[i]}>Token {tokenIds[i]}: {score.toString()}</li>
      ))}
    </ul>
  );
}
```

## Configuration

```ts
interface DenshokanClientConfig {
  chain?: "mainnet" | "sepolia";       // Default: "mainnet"
  apiUrl?: string;                      // REST API base URL
  wsUrl?: string;                       // WebSocket URL
  rpcUrl?: string;                      // Custom Starknet RPC endpoint
  provider?: RpcProvider;               // starknet.js provider (takes precedence over rpcUrl)
  denshokanAddress: string;             // Denshokan contract address (required)
  registryAddress: string;              // MinigameRegistry contract address (required)
  primarySource?: "api" | "rpc";        // Default: "api"
  fetch?: {
    timeout?: number;                   // Default: 10000ms
    maxRetries?: number;                // Default: 3
    baseBackoff?: number;               // Default: 1000ms
    maxBackoff?: number;                // Default: 5000ms
  };
  ws?: {
    maxReconnectAttempts?: number;       // Default: 10
    reconnectBaseDelay?: number;         // Default: 1000ms
  };
}
```

## Type Conventions

All public types use **camelCase** field names:

```ts
interface Token {
  tokenId: string;
  gameId: number;
  owner: string;
  score: number;
  gameOver: boolean;
  playerName: string;
  mintedBy: string;
  mintedAt: string;
  settingsId: number;
  objectiveId: number;
  soulbound: boolean;
  isPlayable: boolean;
  gameAddress: string;
}

interface Game {
  gameId: number;
  name: string;
  description: string;
  contractAddress: string;
  imageUrl?: string;
  createdAt: string;
}
```

## Data Source Fallback

The SDK monitors API and RPC health in the background (30s interval). When the API goes down, methods with RPC fallback (`getGame`, `getToken`) automatically switch to direct contract calls without wasting time on the failed source. When the API recovers, it switches back.

| Method | API | RPC | Fallback |
|--------|-----|-----|----------|
| `getGames()` | Yes | — | API only |
| `getGame(id)` | Yes | Yes | Yes |
| `getToken(id)` | Yes | Yes | Yes |
| `getTokens(filter)` | Yes | — | API only |
| `getPlayerTokens/Stats` | Yes | — | API only |
| `balanceOf(account)` | — | Yes | RPC only |
| `ownerOf(tokenId)` | — | Yes | RPC only |
| `tokenMetadataBatch(ids)` | — | Yes | RPC only |
| `scoreBatch(ids, addr)` | — | Yes | RPC only |

## API Reference

### Client Methods

**Games** — `getGames()`, `getGame(id)`, `getGameLeaderboard(id, opts?)`, `getLeaderboardPosition(gameId, tokenId, context?)`, `getGameObjectives(id)`, `getGameSettings(id)`

**Tokens** — `getTokens(params?)`, `getToken(id)`, `getTokenScores(id, limit?)`

**Players** — `getPlayerTokens(address, params?)`, `getPlayerStats(address)`

**Minters** — `getMinters()`, `getMinter(id)`

**RPC: ERC721** — `balanceOf(account)`, `ownerOf(tokenId)`, `tokenUri(tokenId)`, `name()`, `symbol()`, `royaltyInfo(tokenId, salePrice)`

**RPC: Token Metadata (batch-first)** — `tokenMetadata(id)` / `tokenMetadataBatch(ids)`, `isPlayable` / `isPlayableBatch`, `settingsId` / `settingsIdBatch`, `playerName` / `playerNameBatch`, `objectiveId` / `objectiveIdBatch`, `mintedBy` / `mintedByBatch`, `isSoulbound` / `isSoulboundBatch`, `rendererAddress` / `rendererAddressBatch`, `tokenGameAddress` / `tokenGameAddressBatch`

**RPC: Game Contract (batch-first)** — `score` / `scoreBatch`, `gameOver` / `gameOverBatch`, `tokenName` / `tokenNameBatch`, `tokenDescription` / `tokenDescriptionBatch`, `gameDetails` / `gameDetailsBatch`, `objectivesDetails` / `objectivesDetailsBatch`, `settingsDetails` / `settingsDetailsBatch`, `objectiveExists` / `objectiveExistsBatch`, `settingsExists` / `settingsExistsBatch`

**RPC: Registry** — `gameMetadata(gameId)`, `gameAddress(gameId)`

**RPC: Write** — `mint(params)` / `mintBatch(params[])`, `updateGame(tokenId)` / `updateGameBatch(tokenIds)`, `updatePlayerName(tokenId, name)` / `updatePlayerNameBatch(updates)`

**Utilities** — `decodeTokenId(tokenId)`, `getConnectionStatus()`

**WebSocket** — `subscribe(options, handler)`, `connect()`, `disconnect()`

### React Hooks

All data hooks return `{ data, isLoading, error, refetch }`.

**Data** — `useGames()`, `useTokens(params?)`, `useToken(tokenId)`, `useLeaderboard(gameId, opts?)`, `usePlayerStats(address)`, `useMinters()`

**RPC** — `useBalanceOf(account)`, `useOwnerOf(tokenId)`, `useTokenUri(tokenId)`, `useTokenMetadataBatch(tokenIds)`, `useScoreBatch(tokenIds, gameAddress)`, `useGameOverBatch(tokenIds, gameAddress)`

**WebSocket** — `useSubscription(channels, handler, gameIds?)`

**Context** — `useDenshokanClient()`

## Error Handling

```ts
import { DenshokanError, ApiError, DataSourceError } from "@provable-games/denshokan-sdk";

try {
  const token = await client.getToken("12345");
} catch (error) {
  if (error instanceof DataSourceError) {
    console.log("Primary failed:", error.primaryError.message);
    console.log("Fallback failed:", error.fallbackError.message);
  } else if (error instanceof ApiError) {
    console.log("HTTP status:", error.statusCode);
  }
}
```

Error classes: `DenshokanError`, `ApiError`, `RpcError`, `RateLimitError`, `TimeoutError`, `AbortError`, `TokenNotFoundError`, `GameNotFoundError`, `InvalidChainError`, `DataSourceError`.

## Development

```bash
npm install
npm run build        # ESM + CJS to dist/
npm run typecheck    # TypeScript validation
npm test             # Unit tests
npm run dev          # Watch mode
```

## Publishing

Publishing is automated via GitHub Actions. To release:

1. Bump the version in `package.json`
2. Create a GitHub Release (e.g. `v0.1.0`)
3. The `publish.yml` workflow runs tests, builds, and publishes to npm

Requires an `NPM_TOKEN` secret configured in the repo settings.

## License

MIT
