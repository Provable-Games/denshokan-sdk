import "../helpers/register-dom.js";
import { describe, it, expect, vi } from "vitest";
import { act, StrictMode } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { DenshokanProvider, useDenshokanClient } from "../../src/react/context.js";
import { createDenshokanClient } from "../../src/client.js";
import type { DenshokanClient } from "../../src/client.js";
import type { DenshokanClientConfig } from "../../src/types/config.js";

let captured: DenshokanClient | null = null;

function Probe() {
  captured = useDenshokanClient();
  return null;
}

// Local endpoints and a long initial health delay so no network I/O happens
// within a test's lifetime.
const baseConfig = (): DenshokanClientConfig => ({
  chain: "mainnet",
  apiUrl: "http://127.0.0.1:9099",
  rpcUrl: "http://127.0.0.1:9098",
  denshokanAddress: "0xdead",
  health: { initialCheckDelay: 60_000 },
});

function createHarness() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  return {
    render: (node: ReactNode) => act(async () => { root.render(node); }),
    unmount: async () => {
      await act(async () => { root.unmount(); });
      container.remove();
    },
  };
}

function monitoringArmed(client: DenshokanClient): boolean {
  const status = client.getConnectionStatus() as unknown as {
    checkInterval: unknown;
    initialCheckTimeout: unknown;
  };
  return Boolean(status.checkInterval || status.initialCheckTimeout);
}

describe("DenshokanProvider", () => {
  it("reuses the internal client across re-renders with value-equal inline configs", async () => {
    const { render, unmount } = createHarness();
    await render(
      <DenshokanProvider config={baseConfig()}>
        <Probe />
      </DenshokanProvider>,
    );
    const first = captured!;
    const disconnect = vi.spyOn(first, "disconnect");

    // Each render passes a fresh config object — the documented inline usage.
    for (let i = 0; i < 3; i++) {
      await render(
        <DenshokanProvider config={baseConfig()}>
          <Probe />
        </DenshokanProvider>,
      );
    }

    expect(captured).toBe(first);
    expect(disconnect).not.toHaveBeenCalled();
    await unmount();
  });

  it("rebuilds the client and disconnects the old one when config values change", async () => {
    const { render, unmount } = createHarness();
    await render(
      <DenshokanProvider config={baseConfig()}>
        <Probe />
      </DenshokanProvider>,
    );
    const first = captured!;
    const disconnect = vi.spyOn(first, "disconnect");

    await render(
      <DenshokanProvider config={{ ...baseConfig(), rpcUrl: "http://127.0.0.1:9097" }}>
        <Probe />
      </DenshokanProvider>,
    );

    expect(captured).not.toBe(first);
    expect(disconnect).toHaveBeenCalledTimes(1);
    await unmount();
  });

  it("disconnects the internal client on unmount", async () => {
    const { render, unmount } = createHarness();
    await render(
      <DenshokanProvider config={baseConfig()}>
        <Probe />
      </DenshokanProvider>,
    );
    const client = captured!;
    const disconnect = vi.spyOn(client, "disconnect");
    expect(monitoringArmed(client)).toBe(true);

    await unmount();

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(monitoringArmed(client)).toBe(false);
  });

  it("never disconnects a caller-provided client", async () => {
    const external = createDenshokanClient(baseConfig());
    const disconnect = vi.spyOn(external, "disconnect");
    const { render, unmount } = createHarness();

    await render(
      <DenshokanProvider client={external}>
        <Probe />
      </DenshokanProvider>,
    );
    expect(captured).toBe(external);

    await unmount();
    expect(disconnect).not.toHaveBeenCalled();

    external.disconnect();
  });

  it("keeps the client alive under StrictMode double-mounting", async () => {
    const { render, unmount } = createHarness();
    await render(
      <StrictMode>
        <DenshokanProvider config={baseConfig()}>
          <Probe />
        </DenshokanProvider>
      </StrictMode>,
    );
    const client = captured!;

    // StrictMode runs effect → cleanup → effect: the cleanup disconnects the
    // client, so the effect re-run must re-arm health monitoring.
    expect(monitoringArmed(client)).toBe(true);

    await unmount();
    expect(monitoringArmed(client)).toBe(false);
  });
});
