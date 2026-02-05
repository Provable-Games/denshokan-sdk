export class DenshokanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DenshokanError";
  }
}

export class ApiError extends DenshokanError {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
  }
}

export class RpcError extends DenshokanError {
  readonly contractAddress?: string;

  constructor(message: string, contractAddress?: string) {
    super(message);
    this.name = "RpcError";
    this.contractAddress = contractAddress;
  }
}

export class RateLimitError extends DenshokanError {
  readonly retryAfter: number | null;

  constructor(message: string, retryAfter: number | null = null) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

export class TimeoutError extends DenshokanError {
  constructor(message = "Request timed out") {
    super(message);
    this.name = "TimeoutError";
  }
}

export class AbortError extends DenshokanError {
  constructor(message = "Request was aborted") {
    super(message);
    this.name = "AbortError";
  }
}

export class TokenNotFoundError extends DenshokanError {
  readonly tokenId: string;

  constructor(tokenId: string) {
    super(`Token not found: ${tokenId}`);
    this.name = "TokenNotFoundError";
    this.tokenId = tokenId;
  }
}

export class GameNotFoundError extends DenshokanError {
  readonly gameId: string | number;

  constructor(gameId: string | number) {
    super(`Game not found: ${gameId}`);
    this.name = "GameNotFoundError";
    this.gameId = gameId;
  }
}

export class InvalidChainError extends DenshokanError {
  readonly chain: string;

  constructor(chain: string) {
    super(`Invalid chain: ${chain}. Supported: mainnet, sepolia`);
    this.name = "InvalidChainError";
    this.chain = chain;
  }
}

export class DataSourceError extends DenshokanError {
  readonly primaryError: Error;
  readonly fallbackError: Error;

  constructor(primaryError: Error, fallbackError: Error) {
    super(`Both data sources failed. Primary: ${primaryError.message}. Fallback: ${fallbackError.message}`);
    this.name = "DataSourceError";
    this.primaryError = primaryError;
    this.fallbackError = fallbackError;
  }
}

export function isNonRetryableError(error: unknown): boolean {
  if (error instanceof AbortError) return true;
  if (error instanceof TokenNotFoundError) return true;
  if (error instanceof GameNotFoundError) return true;
  if (error instanceof InvalidChainError) return true;
  if (error instanceof ApiError && error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
    return true;
  }
  return false;
}
