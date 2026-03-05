import { shortString, type Contract } from "starknet";
import type { GameDetail, GameObjectiveDetails, GameSettingDetails } from "../types/game.js";
import { RpcError } from "../errors/index.js";

function wrapRpcCall<T>(fn: () => Promise<T>, contractAddress?: string): Promise<T> {
  return fn().catch((error: unknown) => {
    throw new RpcError(
      error instanceof Error ? error.message : "RPC call failed",
      contractAddress,
    );
  });
}

// === Score & game state (batch-first) ===

export async function rpcScoreBatch(
  contract: Contract,
  tokenIds: string[],
): Promise<bigint[]> {
  return wrapRpcCall(async () => {
    const result = await contract.call("score_batch", [tokenIds]);
    return (result as unknown as unknown[]).map((v) => BigInt(v?.toString() ?? "0"));
  }, contract.address);
}

export async function rpcScore(contract: Contract, tokenId: string): Promise<bigint> {
  const [result] = await rpcScoreBatch(contract, [tokenId]);
  return result;
}

export async function rpcGameOverBatch(
  contract: Contract,
  tokenIds: string[],
): Promise<boolean[]> {
  return wrapRpcCall(async () => {
    const result = await contract.call("game_over_batch", [tokenIds]);
    return (result as unknown as unknown[]).map((v) => Boolean(v));
  }, contract.address);
}

export async function rpcGameOver(contract: Contract, tokenId: string): Promise<boolean> {
  const [result] = await rpcGameOverBatch(contract, [tokenId]);
  return result;
}

// === Game details (batch-first) ===

export async function rpcTokenNameBatch(
  contract: Contract,
  tokenIds: string[],
): Promise<string[]> {
  return wrapRpcCall(async () => {
    const result = await contract.call("token_name_batch", [tokenIds]);
    return (result as unknown as unknown[]).map((v) => v?.toString() ?? "");
  }, contract.address);
}

export async function rpcTokenName(contract: Contract, tokenId: string): Promise<string> {
  const [result] = await rpcTokenNameBatch(contract, [tokenId]);
  return result;
}

export async function rpcTokenDescriptionBatch(
  contract: Contract,
  tokenIds: string[],
): Promise<string[]> {
  return wrapRpcCall(async () => {
    const result = await contract.call("token_description_batch", [tokenIds]);
    return (result as unknown as unknown[]).map((v) => v?.toString() ?? "");
  }, contract.address);
}

export async function rpcTokenDescription(contract: Contract, tokenId: string): Promise<string> {
  const [result] = await rpcTokenDescriptionBatch(contract, [tokenId]);
  return result;
}

export async function rpcGameDetailsBatch(
  contract: Contract,
  tokenIds: string[],
): Promise<GameDetail[][]> {
  return wrapRpcCall(async () => {
    const result = await contract.call("game_details_batch", [tokenIds]);
    return (result as unknown as unknown[]).map((span) =>
      ((span as unknown[]) ?? []).map(parseGameDetail),
    );
  }, contract.address);
}

export async function rpcGameDetails(
  contract: Contract,
  tokenId: string,
): Promise<GameDetail[]> {
  const [result] = await rpcGameDetailsBatch(contract, [tokenId]);
  return result;
}

// === Objectives (batch-first) ===

export async function rpcObjectivesCount(contract: Contract): Promise<number> {
  return wrapRpcCall(async () => {
    const result = await contract.call("objectives_count", []);
    return Number(result ?? 0);
  }, contract.address);
}

export async function rpcObjectiveExistsBatch(
  contract: Contract,
  objectiveIds: number[],
): Promise<boolean[]> {
  return wrapRpcCall(async () => {
    const result = await contract.call("objective_exists_batch", [objectiveIds]);
    return (result as unknown as unknown[]).map((v) => Boolean(v));
  }, contract.address);
}

export async function rpcObjectiveExists(
  contract: Contract,
  objectiveId: number,
): Promise<boolean> {
  const [result] = await rpcObjectiveExistsBatch(contract, [objectiveId]);
  return result;
}

export async function rpcCompletedObjectiveBatch(
  contract: Contract,
  tokenIds: string[],
  objectiveId: number,
): Promise<boolean[]> {
  return wrapRpcCall(async () => {
    // Call completed_objective for each token in sequence since the contract
    // doesn't have a batch version for this
    const results = await Promise.all(
      tokenIds.map((tokenId) => contract.call("completed_objective", [tokenId, objectiveId])),
    );
    return results.map((v) => Boolean(v));
  }, contract.address);
}

export async function rpcCompletedObjective(
  contract: Contract,
  tokenId: string,
  objectiveId: number,
): Promise<boolean> {
  return wrapRpcCall(async () => {
    const result = await contract.call("completed_objective", [tokenId, objectiveId]);
    return Boolean(result);
  }, contract.address);
}

export async function rpcObjectivesDetailsBatch(
  contract: Contract,
  objectiveIds: number[],
): Promise<GameObjectiveDetails[]> {
  return wrapRpcCall(async () => {
    const result = await contract.call("objectives_details_batch", [objectiveIds]);
    return (result as unknown as unknown[]).map((raw, index) =>
      parseGameObjectiveDetails(raw, objectiveIds[index]),
    );
  }, contract.address);
}

export async function rpcObjectivesDetails(
  contract: Contract,
  objectiveId: number,
): Promise<GameObjectiveDetails> {
  const [result] = await rpcObjectivesDetailsBatch(contract, [objectiveId]);
  return result;
}

// === Settings (batch-first) ===

export async function rpcSettingsCount(contract: Contract): Promise<number> {
  return wrapRpcCall(async () => {
    const result = await contract.call("settings_count", []);
    return Number(result ?? 0);
  }, contract.address);
}

export async function rpcSettingsExistsBatch(
  contract: Contract,
  settingsIds: number[],
): Promise<boolean[]> {
  return wrapRpcCall(async () => {
    const result = await contract.call("settings_exist_batch", [settingsIds]);
    return (result as unknown as unknown[]).map((v) => Boolean(v));
  }, contract.address);
}

export async function rpcSettingsExists(
  contract: Contract,
  settingsId: number,
): Promise<boolean> {
  const [result] = await rpcSettingsExistsBatch(contract, [settingsId]);
  return result;
}

export async function rpcSettingsDetailsBatch(
  contract: Contract,
  settingsIds: number[],
): Promise<GameSettingDetails[]> {
  return wrapRpcCall(async () => {
    const result = await contract.call("settings_details_batch", [settingsIds]);
    return (result as unknown as unknown[]).map((raw, index) =>
      parseGameSettingDetails(raw, settingsIds[index]),
    );
  }, contract.address);
}

export async function rpcSettingsDetail(
  contract: Contract,
  settingsId: number,
): Promise<GameSettingDetails> {
  const [result] = await rpcSettingsDetailsBatch(contract, [settingsId]);
  return result;
}

// === Helpers ===

function parseGameDetail(raw: unknown): GameDetail {
  const obj = raw as Record<string, unknown>;
  return {
    key: shortString.decodeShortString(obj.name?.toString() ?? "0x0"),
    value: shortString.decodeShortString(obj.value?.toString() ?? "0x0"),
  };
}

function parseKeyValuePairs(raw: unknown[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const item of raw) {
    const obj = item as Record<string, unknown>;
    const name = shortString.decodeShortString(obj.name?.toString() ?? "0x0");
    const value = shortString.decodeShortString(obj.value?.toString() ?? "0x0");
    if (name) result[name] = value;
  }
  return result;
}

function parseGameObjectiveDetails(raw: unknown, id: number): GameObjectiveDetails {
  const obj = raw as Record<string, unknown>;
  return {
    id,
    gameAddress: "",
    creatorAddress: "",
    name: obj.name?.toString() ?? "",
    description: obj.description?.toString() ?? "",
    objectives: parseKeyValuePairs((obj.objectives as unknown[]) ?? []),
    blockNumber: "",
    createdAt: "",
  };
}

function parseGameSettingDetails(raw: unknown, id: number): GameSettingDetails {
  const obj = raw as Record<string, unknown>;
  return {
    id,
    gameAddress: "",
    creatorAddress: "",
    name: obj.name?.toString() ?? "",
    description: obj.description?.toString() ?? "",
    settings: parseKeyValuePairs((obj.settings as unknown[]) ?? []),
    blockNumber: "",
    createdAt: "",
  };
}
