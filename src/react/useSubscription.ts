import { useEffect, useRef } from "react";
import type { WSChannel, WSEventHandler } from "../types/websocket.js";
import { useDenshokanClient } from "./context.js";

export function useSubscription(
  channels: WSChannel[],
  handler: WSEventHandler,
  gameIds?: number[],
): void {
  const client = useDenshokanClient();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (channels.length === 0) return;

    client.connect();

    const unsubscribe = client.subscribe(
      { channels, gameIds },
      (message) => handlerRef.current(message),
    );

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, JSON.stringify(channels), JSON.stringify(gameIds)]);
}
