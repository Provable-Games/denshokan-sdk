import { describe, it, expect } from "vitest";

// A mock global WebSocket so the manager's ctor resolution picks it up (browser /
// Node>=21 path). Set BEFORE importing the manager so the cached resolver grabs it.
class MockWS {
  static instances: MockWS[] = [];
  url: string;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];
  constructor(url: string) {
    this.url = url;
    MockWS.instances.push(this);
  }
  send(d: string) {
    this.sent.push(d);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  message(obj: unknown) {
    this.onmessage?.({ data: JSON.stringify(obj) });
  }
}
(globalThis as unknown as { WebSocket: unknown }).WebSocket = MockWS;

const { WebSocketManager } = await import("../../src/ws/manager.js");

const tick = () => new Promise((r) => setTimeout(r, 0));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("WebSocketManager", () => {
  it("connects via the resolved WebSocket and subscribes on open", async () => {
    const m = new WebSocketManager("wss://x/ws");
    const events: Array<{ data: { score: number } }> = [];
    m.subscribe({ channels: ["scores"], gameIds: [1] }, (msg) =>
      events.push(msg as { data: { score: number } }),
    );
    m.connect();
    await tick(); // ctor is resolved via an async import

    const ws = MockWS.instances.at(-1)!;
    ws.open();
    expect(ws.sent).toHaveLength(1);
    expect(JSON.parse(ws.sent[0]!)).toMatchObject({
      type: "subscribe",
      channels: ["scores"],
      gameIds: ["1"],
    });

    ws.message({ channel: "scores", data: { token_id: "1", score: 42 } });
    expect(events).toHaveLength(1);
    expect(events[0]!.data.score).toBe(42);
  });

  it("re-subscribes after the socket drops (infinite reconnect by default)", async () => {
    const before = MockWS.instances.length;
    const m = new WebSocketManager("wss://x/ws", { reconnectBaseDelay: 1 });
    m.subscribe({ channels: ["scores"] }, () => {});
    m.connect();
    await tick();
    const ws1 = MockWS.instances.at(-1)!;
    ws1.open();
    ws1.close(); // → schedules a reconnect
    await wait(15); // reconnect delay (1ms) + async ctor
    await tick();

    const ws2 = MockWS.instances.at(-1)!;
    expect(MockWS.instances.length).toBeGreaterThan(before + 1);
    expect(ws2).not.toBe(ws1);
    ws2.open();
    expect(ws2.sent).toHaveLength(1); // subscription replayed on the new socket
  });
});
