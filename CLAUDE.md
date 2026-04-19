# Denshokan SDK — Development Guide

## Overview

`@provable-games/denshokan-sdk` is a TypeScript package that queries Denshokan game token data from both a REST API and direct Starknet RPC contract calls, with configurable priority and automatic fallback between sources. Batch RPC endpoints are used wherever possible for efficient multi-token queries.

## Package Manager

**CRITICAL: Always use `bun`, never `npm`, `yarn`, or `pnpm`.** This project uses `bun.lock` as the single lockfile. Do not run `npm install`, `npm ci`, or any npm commands that manage dependencies. Do not generate `package-lock.json`.

## Commands

```bash
bun install          # Install dependencies
bun run build        # Build ESM + CJS to dist/
bun run typecheck    # TypeScript type checking (tsc --noEmit)
bun test             # Run unit tests (vitest run)
bun run test:watch   # Run tests in watch mode
bun run dev          # Build in watch mode
bun run clean        # Remove dist/
```

## Architecture

### Directory Structure

```
src/
├── index.ts                  # Main entry — re-exports everything
├── client.ts                 # DenshokanClient class (wires all layers together)
├── types/                    # All TypeScript interfaces (camelCase fields)
│   ├── config.ts             # DenshokanClientConfig, DataSource
│   ├── token.ts              # Token, DecodedTokenId, TokenMetadata
│   ├── game.ts               # Game, LeaderboardEntry, GameDetail
│   ├── player.ts             # PlayerStats
│   ├── minter.ts             # Minter
│   ├── websocket.ts          # WSChannel, WSMessage
│   └── rpc.ts                # RoyaltyInfo, GameMetadata, MintParams
├── api/                      # REST API layer
│   ├── base.ts               # apiFetch with retry/timeout/abort
│   ├── games.ts              # Game endpoints
│   ├── tokens.ts             # Token endpoints
│   ├── players.ts            # Player endpoints
│   ├── minters.ts            # Minter endpoints
├── rpc/                      # Starknet RPC layer
│   ├── provider.ts           # createProvider, createContract helpers
│   ├── denshokan.ts          # Denshokan contract (ERC721 + batch metadata)
│   ├── registry.ts           # MinigameRegistry contract
│   ├── game.ts               # Game contract (score, details, objectives, settings)
│   └── abis/
│       └── denshokan.json    # Contract ABI
├── datasource/
│   ├── health.ts             # ConnectionStatus — API/RPC health monitoring
│   └── resolver.ts           # withFallback<T>() smart data source switching
├── ws/
│   └── manager.ts            # WebSocketManager — subscriptions + auto-reconnect
├── utils/
│   ├── retry.ts              # withRetry, calculateBackoff, sleep
│   ├── token-id.ts           # decodePackedTokenId (felt252 bit unpacking)
│   ├── address.ts            # normalizeAddress
│   └── mappers.ts            # snake_case ↔ camelCase transformers
├── errors/
│   └── index.ts              # DenshokanError hierarchy
├── chains/
│   └── constants.ts          # Chain configs, default RPC URLs
└── react/
    ├── index.ts              # React entry point (separate build output)
    ├── context.tsx           # DenshokanProvider, useDenshokanClient
    ├── useGames.ts           # useGames hook
    ├── useTokens.ts          # useTokens, useToken hooks
    ├── useLeaderboard.ts     # useLeaderboard hook
    ├── usePlayer.ts          # usePlayerStats hook
    ├── useMinters.ts         # useMinters hook
    ├── useSubscription.ts    # WebSocket subscription hook
    └── useRpc.ts             # useBalanceOf, useOwnerOf, useTokenUri, batch hooks
```

### Key Design Patterns

**camelCase public types, snake_case wire protocol:** All SDK consumer-facing types use camelCase (`tokenId`, `gameId`, `playerName`). Transformation happens at the API/RPC boundary via `src/utils/mappers.ts`. Contract call strings (`"balance_of"`) and API query params (`game_id=`) remain snake_case since they're external protocol identifiers.

**Batch-first RPC:** All batch contract methods are the primary implementation. Single-item methods delegate to batch with a single-element array:

```ts
// Batch is the real implementation
export async function rpcTokenMetadataBatch(contract, tokenIds) { ... }

// Single delegates to batch
export async function rpcTokenMetadata(contract, tokenId) {
  const [result] = await rpcTokenMetadataBatch(contract, [tokenId]);
  return result;
}
```

**Smart fallback with health monitoring:** `ConnectionStatus` runs background health checks (30s interval). `withFallback()` checks the current mode before trying sources — skips the primary if it's known-down:

```ts
// In rpc-fallback mode, goes straight to RPC without wasting time on API
async function withFallback<T>(primary, fallback, health?) { ... }
```

**Game address caching:** The client caches `gameId → contractAddress` mappings from the registry to avoid redundant RPC calls. When `score(tokenId)` is called without a gameAddress, the client decodes the gameId from the packed token ID and resolves it via cache or registry.

**Lazy RPC initialization:** Provider and Contract objects are created on first use, not at construction time. This means importing the SDK doesn't require `starknet` as a dependency unless RPC methods are actually called.

### Type Naming Convention

All exported types use **camelCase** field names:

```ts
interface Token {
  tokenId: string;      // not token_id
  gameId: number;       // not game_id
  playerName: string;   // not player_name
  isPlayable: boolean;  // not is_playable
  // ...
}

interface Game {
  gameId: number;           // not id
  contractAddress: string;  // not contract_address
  imageUrl?: string;        // not image_url
  createdAt: string;        // not created_at
  // ...
}
```

The mappers in `src/utils/mappers.ts` handle bidirectional conversion:
- `mapToken()`, `mapGame()`, etc. — convert API JSON (snake_case) → SDK types (camelCase)
- `mintParamsToSnake()`, `playerNameUpdateToSnake()` — convert SDK params → RPC wire format

### Build

Two entry points built with tsup:
- `src/index.ts` → `dist/index.js` (ESM) + `dist/index.cjs` (CJS)
- `src/react/index.ts` → `dist/react.js` (ESM) + `dist/react.cjs` (CJS)

Both `react` and `starknet` are external peer dependencies.

### Data Source Coverage

| Method | API | RPC | Fallback |
|--------|-----|-----|----------|
| `getGames()` | Yes | — | API only |
| `getGame(id)` | Yes | Yes (registry) | Yes |
| `getToken(id)` | Yes | Yes (metadata + owner) | Yes |
| `getTokens(filter)` | Yes | — | API only |
| `getPlayerTokens/Stats` | Yes | — | API only |
| `balanceOf`, `ownerOf` | — | Yes | RPC only |
| `tokenUri`, `tokenUriBatch` | Yes | Yes | Yes |
| `tokenMetadataBatch` | — | Yes | RPC only |
| `scoreBatch`, `gameOverBatch` | — | Yes | RPC only |

### Error Hierarchy

```
DenshokanError (base)
├── ApiError (statusCode)
├── RpcError (contractAddress)
├── RateLimitError (retryAfter)
├── TimeoutError
├── AbortError
├── TokenNotFoundError (tokenId)
├── GameNotFoundError (gameId)
├── InvalidChainError (chain)
└── DataSourceError (primaryError + fallbackError)
```

Non-retryable errors (4xx except 429, AbortError, not-found errors) are never retried by `withRetry`.

### Related Repositories

- [denshokan](https://github.com/Provable-Games/denshokan) — API server, client app, and contracts
- [ekubo-sdk](https://github.com/Provable-Games/ekubo-sdk) — Sister SDK (same build patterns)

### Testing

Tests live in `tests/unit/`. Run with `npm test`. Current test coverage:
- `token-id.test.ts` — Packed token ID decoder (bit field extraction)
- `resolver.test.ts` — `withFallback` data source switching logic
- `api.test.ts` — `apiFetch` and `buildQueryString` utilities

### CI/CD

- **`.github/workflows/ci.yml`** — Runs typecheck, build, test on push/PR to main
- **`.github/workflows/publish.yml`** — Publishes to npm on GitHub Release (requires `NPM_TOKEN` secret)
