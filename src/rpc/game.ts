import type { Contract } from "starknet";
import type { GameDetail, GameObjective, GameSettingDetails } from "../types/game.js";
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

export async function rpcObjectivesDetailsBatch(
  contract: Contract,
  tokenIds: string[],
): Promise<GameObjective[][]> {
  return wrapRpcCall(async () => {
    const result = await contract.call("objectives_details_batch", [tokenIds]);
    return (result as unknown as unknown[]).map((span) =>
      ((span as unknown[]) ?? []).map(parseGameObjective),
    );
  }, contract.address);
}

export async function rpcObjectivesDetails(
  contract: Contract,
  tokenId: string,
): Promise<GameObjective[]> {
  const [result] = await rpcObjectivesDetailsBatch(contract, [tokenId]);
  return result;
}

// === Settings (batch-first) ===

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
    return (result as unknown as unknown[]).map(parseGameSettingDetails);
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
    key: obj.key?.toString() ?? "",
    value: obj.value?.toString() ?? "",
  };
}

function parseGameObjective(raw: unknown): GameObjective {
  const obj = raw as Record<string, unknown>;
  return {
    id: Number(obj.id ?? 0),
    name: obj.name?.toString() ?? "",
    description: obj.description?.toString() ?? "",
  };
}

function parseGameSettingDetails(raw: unknown): GameSettingDetails {
  const obj = raw as Record<string, unknown>;
  return {
    id: Number(obj.id ?? 0),
    name: obj.name?.toString() ?? "",
    description: obj.description?.toString() ?? "",
  };
}
