import { describe, it, expect } from "vitest";
import {
  mapScoreEvent,
  mapGameOverEvent,
  mapMintEvent,
  mapTokenUpdateEvent,
  mapNewGameEvent,
  mapNewMinterEvent,
  mapNewSettingEvent,
  mapNewObjectiveEvent,
  WS_EVENT_MAPPERS,
} from "../../src/utils/mappers.js";

describe("mapScoreEvent", () => {
  it("should convert snake_case to camelCase", () => {
    const raw = {
      token_id: "0x123",
      game_id: 1,
      score: 500,
      owner_address: "0xabc",
      player_name: "Alice",
    };
    expect(mapScoreEvent(raw)).toEqual({
      tokenId: "0x123",
      gameId: 1,
      score: 500,
      ownerAddress: "0xabc",
      playerName: "Alice",
      contextId: null,
      mintedBy: null,
      settingsId: null,
      objectiveId: null,
    });
  });

  it("should handle missing fields with defaults", () => {
    const raw = {};
    expect(mapScoreEvent(raw)).toEqual({
      tokenId: "",
      gameId: 0,
      score: 0,
      ownerAddress: "",
      playerName: "",
      contextId: null,
      mintedBy: null,
      settingsId: null,
      objectiveId: null,
    });
  });

  it("should map filter fields when present", () => {
    const raw = {
      token_id: "0x123",
      game_id: 1,
      score: 500,
      owner_address: "0xabc",
      player_name: "Alice",
      context_id: 42,
      minted_by: 12345,
      settings_id: 3,
      objective_id: 7,
    };
    const result = mapScoreEvent(raw);
    expect(result.contextId).toBe(42);
    expect(result.mintedBy).toBe(12345);
    expect(result.settingsId).toBe(3);
    expect(result.objectiveId).toBe(7);
  });
});

describe("mapGameOverEvent", () => {
  it("should convert snake_case to camelCase", () => {
    const raw = {
      token_id: "0x456",
      game_id: 2,
      score: 1000,
      owner_address: "0xdef",
      player_name: "Bob",
      completed_all_objectives: true,
    };
    expect(mapGameOverEvent(raw)).toEqual({
      tokenId: "0x456",
      gameId: 2,
      score: 1000,
      ownerAddress: "0xdef",
      playerName: "Bob",
      completedAllObjectives: true,
      contextId: null,
      mintedBy: null,
      settingsId: null,
      objectiveId: null,
    });
  });

  it("should map filter fields when present", () => {
    const raw = {
      token_id: "0x456",
      game_id: 2,
      score: 1000,
      owner_address: "0xdef",
      player_name: "Bob",
      completed_all_objectives: true,
      context_id: 10,
      minted_by: 9999,
      settings_id: 2,
      objective_id: 5,
    };
    const result = mapGameOverEvent(raw);
    expect(result.contextId).toBe(10);
    expect(result.mintedBy).toBe(9999);
    expect(result.settingsId).toBe(2);
    expect(result.objectiveId).toBe(5);
  });

  it("should default completedAllObjectives to false", () => {
    const raw = { token_id: "0x1" };
    const result = mapGameOverEvent(raw);
    expect(result.completedAllObjectives).toBe(false);
  });
});

describe("mapMintEvent", () => {
  it("should convert snake_case to camelCase", () => {
    const raw = {
      token_id: "0x789",
      game_id: 3,
      owner_address: "0xfed",
      minted_by: "0xcba",
      settings_id: 5,
    };
    expect(mapMintEvent(raw)).toEqual({
      tokenId: "0x789",
      gameId: 3,
      ownerAddress: "0xfed",
      mintedBy: "0xcba",
      settingsId: 5,
      contextId: null,
      objectiveId: null,
    });
  });

  it("should handle missing fields with defaults", () => {
    const raw = {};
    expect(mapMintEvent(raw)).toEqual({
      tokenId: "",
      gameId: 0,
      ownerAddress: "",
      mintedBy: "",
      settingsId: 0,
      contextId: null,
      objectiveId: null,
    });
  });

  it("should map filter fields when present", () => {
    const raw = {
      token_id: "0x789",
      game_id: 3,
      owner_address: "0xfed",
      minted_by: "0xcba",
      settings_id: 5,
      context_id: 99,
      objective_id: 11,
    };
    const result = mapMintEvent(raw);
    expect(result.contextId).toBe(99);
    expect(result.objectiveId).toBe(11);
  });
});

describe("mapTokenUpdateEvent", () => {
  it("should map score_update type to scoreUpdate", () => {
    const raw = { type: "score_update", token_id: "0x1", game_id: 1, score: 100 };
    const result = mapTokenUpdateEvent(raw);
    expect(result).toEqual({ type: "scoreUpdate", tokenId: "0x1", gameId: 1, score: 100 });
  });

  it("should map game_over type to gameOver", () => {
    const raw = { type: "game_over", token_id: "0x2", game_id: 2, score: 200 };
    const result = mapTokenUpdateEvent(raw);
    expect(result).toEqual({ type: "gameOver", tokenId: "0x2", gameId: 2, score: 200 });
  });

  it("should map minted type to minted", () => {
    const raw = { type: "minted", token_id: "0x3", game_id: 3, owner_address: "0xabc" };
    const result = mapTokenUpdateEvent(raw);
    expect(result).toEqual({ type: "minted", tokenId: "0x3", gameId: 3, ownerAddress: "0xabc" });
  });

  it("should default unknown type to scoreUpdate", () => {
    const raw = { type: "unknown", token_id: "0x4", game_id: 4, score: 50 };
    const result = mapTokenUpdateEvent(raw);
    expect(result.type).toBe("scoreUpdate");
  });
});

describe("mapNewGameEvent", () => {
  it("should convert snake_case to camelCase", () => {
    const raw = { game_id: 10, contract_address: "0xgame", name: "TestGame" };
    expect(mapNewGameEvent(raw)).toEqual({
      gameId: 10,
      contractAddress: "0xgame",
      name: "TestGame",
    });
  });

  it("should handle missing fields with defaults", () => {
    const raw = {};
    expect(mapNewGameEvent(raw)).toEqual({
      gameId: 0,
      contractAddress: "",
      name: "",
    });
  });
});

describe("mapNewMinterEvent", () => {
  it("should convert snake_case to camelCase", () => {
    const raw = {
      minter_id: "42",
      contract_address: "0xminter",
      name: "TestMinter",
      block_number: "12345",
    };
    expect(mapNewMinterEvent(raw)).toEqual({
      minterId: "42",
      contractAddress: "0xminter",
      name: "TestMinter",
      blockNumber: "12345",
    });
  });

  it("should handle missing fields with defaults", () => {
    const raw = {};
    expect(mapNewMinterEvent(raw)).toEqual({
      minterId: "",
      contractAddress: "",
      name: "",
      blockNumber: "",
    });
  });
});

describe("WS_EVENT_MAPPERS", () => {
  it("should have all 8 channels mapped", () => {
    expect(Object.keys(WS_EVENT_MAPPERS)).toEqual([
      "scores",
      "game_over",
      "mints",
      "tokens",
      "games",
      "minters",
      "settings",
      "objectives",
    ]);
  });

  it("should map each channel correctly", () => {
    expect(WS_EVENT_MAPPERS.scores).toBe(mapScoreEvent);
    expect(WS_EVENT_MAPPERS.game_over).toBe(mapGameOverEvent);
    expect(WS_EVENT_MAPPERS.mints).toBe(mapMintEvent);
    expect(WS_EVENT_MAPPERS.tokens).toBe(mapTokenUpdateEvent);
    expect(WS_EVENT_MAPPERS.games).toBe(mapNewGameEvent);
    expect(WS_EVENT_MAPPERS.minters).toBe(mapNewMinterEvent);
    expect(WS_EVENT_MAPPERS.settings).toBe(mapNewSettingEvent);
    expect(WS_EVENT_MAPPERS.objectives).toBe(mapNewObjectiveEvent);
  });
});
