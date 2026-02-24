import { describe, it, expect } from "vitest";
import { MintSaltCounter, assignSalts, MAX_SALT } from "../../src/utils/salt.js";

describe("MAX_SALT", () => {
  it("should be 1023 (10-bit max)", () => {
    expect(MAX_SALT).toBe(1023);
  });
});

describe("MintSaltCounter", () => {
  it("should start at 0 by default", () => {
    const counter = new MintSaltCounter();
    expect(counter.next()).toBe(0);
  });

  it("should increment on each next() call", () => {
    const counter = new MintSaltCounter();
    expect(counter.next()).toBe(0);
    expect(counter.next()).toBe(1);
    expect(counter.next()).toBe(2);
  });

  it("should accept a custom start value", () => {
    const counter = new MintSaltCounter(10);
    expect(counter.next()).toBe(10);
    expect(counter.next()).toBe(11);
  });

  it("should wrap at 1023 back to 0", () => {
    const counter = new MintSaltCounter(1022);
    expect(counter.next()).toBe(1022);
    expect(counter.next()).toBe(1023);
    expect(counter.next()).toBe(0);
    expect(counter.next()).toBe(1);
  });

  it("should mask start value to 10-bit range", () => {
    const counter = new MintSaltCounter(1024);
    expect(counter.next()).toBe(0);

    const counter2 = new MintSaltCounter(1025);
    expect(counter2.next()).toBe(1);
  });

  it("peek() should return current value without advancing", () => {
    const counter = new MintSaltCounter(5);
    expect(counter.peek()).toBe(5);
    expect(counter.peek()).toBe(5);
    counter.next();
    expect(counter.peek()).toBe(6);
  });

  it("reset() should set counter back to 0 by default", () => {
    const counter = new MintSaltCounter();
    counter.next();
    counter.next();
    counter.reset();
    expect(counter.next()).toBe(0);
  });

  it("reset() should accept a custom start value", () => {
    const counter = new MintSaltCounter();
    counter.next();
    counter.reset(50);
    expect(counter.next()).toBe(50);
  });

  it("reset() should mask value to 10-bit range", () => {
    const counter = new MintSaltCounter();
    counter.reset(2048);
    expect(counter.next()).toBe(0);
  });
});

describe("assignSalts", () => {
  it("should assign incrementing salts starting at 0", () => {
    const items = [{ name: "a" }, { name: "b" }, { name: "c" }];
    const result = assignSalts(items);
    expect(result).toEqual([
      { name: "a", salt: 0 },
      { name: "b", salt: 1 },
      { name: "c", salt: 2 },
    ]);
  });

  it("should preserve explicit salt values", () => {
    const items = [
      { name: "a" },
      { name: "b", salt: 99 },
      { name: "c" },
    ];
    const result = assignSalts(items);
    expect(result).toEqual([
      { name: "a", salt: 0 },
      { name: "b", salt: 99 },
      { name: "c", salt: 1 },
    ]);
  });

  it("should accept a custom start salt", () => {
    const items = [{ name: "a" }, { name: "b" }];
    const result = assignSalts(items, 10);
    expect(result).toEqual([
      { name: "a", salt: 10 },
      { name: "b", salt: 11 },
    ]);
  });

  it("should handle empty array", () => {
    const result = assignSalts([]);
    expect(result).toEqual([]);
  });

  it("should handle all explicit salts", () => {
    const items = [
      { name: "a", salt: 5 },
      { name: "b", salt: 10 },
    ];
    const result = assignSalts(items);
    expect(result).toEqual([
      { name: "a", salt: 5 },
      { name: "b", salt: 10 },
    ]);
  });

  it("should treat salt: 0 as explicit", () => {
    const items = [{ name: "a", salt: 0 }, { name: "b" }];
    const result = assignSalts(items);
    expect(result).toEqual([
      { name: "a", salt: 0 },
      { name: "b", salt: 0 },
    ]);
  });
});
