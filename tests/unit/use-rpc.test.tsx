import "../helpers/register-dom.js";
import { describe, it, expect, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { DenshokanProvider } from "../../src/react/context.js";
import { useBalanceOf } from "../../src/react/useRpc.js";
import type { DenshokanClient } from "../../src/client.js";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

let latest: ReturnType<typeof useBalanceOf> | null = null;

function Probe({ account }: { account?: string }) {
  latest = useBalanceOf(account);
  return null;
}

describe("useAsync (via useBalanceOf)", () => {
  it("discards a stale response that resolves after a newer request", async () => {
    const first = deferred<bigint>();
    const second = deferred<bigint>();
    const responses = [first, second];
    const balanceOf = vi.fn(() => responses.shift()!.promise);
    const client = { balanceOf } as unknown as DenshokanClient;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DenshokanProvider client={client}>
          <Probe account="0x1" />
        </DenshokanProvider>,
      );
    });
    await act(async () => {
      root.render(
        <DenshokanProvider client={client}>
          <Probe account="0x2" />
        </DenshokanProvider>,
      );
    });
    expect(balanceOf).toHaveBeenCalledTimes(2);

    // The newer request resolves first…
    await act(async () => { second.resolve(222n); await second.promise; });
    expect(latest!.data).toBe(222n);
    expect(latest!.isLoading).toBe(false);

    // …then the stale request resolves and must not overwrite the result.
    await act(async () => { first.resolve(111n); await first.promise; });
    expect(latest!.data).toBe(222n);
    expect(latest!.isLoading).toBe(false);

    await act(async () => { root.unmount(); });
    container.remove();
  });

  it("does not commit an in-flight response after the hook becomes disabled", async () => {
    const pending = deferred<bigint>();
    const balanceOf = vi.fn(() => pending.promise);
    const client = { balanceOf } as unknown as DenshokanClient;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DenshokanProvider client={client}>
          <Probe account="0x1" />
        </DenshokanProvider>,
      );
    });
    expect(latest!.isLoading).toBe(true);

    // Disable while the request is still in flight (e.g. wallet disconnect).
    await act(async () => {
      root.render(
        <DenshokanProvider client={client}>
          <Probe />
        </DenshokanProvider>,
      );
    });
    expect(latest!.isLoading).toBe(false);
    expect(latest!.error).toBe(null);

    // The old request resolving must not commit data for the disabled hook.
    await act(async () => { pending.resolve(111n); await pending.promise; });
    expect(latest!.data).toBe(null);
    expect(latest!.isLoading).toBe(false);

    await act(async () => { root.unmount(); });
    container.remove();
  });
});
