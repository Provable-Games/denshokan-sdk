import { useEffect, useRef } from "react";
import type { WSChannel, WSEventHandler, WSSubscribeOptions } from "../types/websocket.js";
import { useDenshokanClient } from "./context.js";

export interface UseSubscriptionOptions {
  channels: WSChannel[];
  gameIds?: number[];
  contextIds?: number[];
  minterAddresses?: string[];
  owners?: string[];
  settingsIds?: number[];
  objectiveIds?: number[];
}

export function useSubscription(
  channelsOrOptions: WSChannel[] | UseSubscriptionOptions,
  handler: WSEventHandler,
  gameIds?: number[],
): void {
  const client = useDenshokanClient();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  // Support both legacy (channels[], handler, gameIds?) and options object signatures
  const options: WSSubscribeOptions = Array.isArray(channelsOrOptions)
    ? { channels: channelsOrOptions, gameIds }
    : channelsOrOptions;

  useEffect(() => {
    if (options.channels.length === 0) return;

    client.connect();

    const unsubscribe = client.subscribe(
      options,
      (message) => handlerRef.current(message),
    );

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, JSON.stringify(options)]);
}
