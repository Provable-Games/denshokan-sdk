import { useState, useEffect, useRef, useCallback } from "react";
import type { WSChannel, WSChannelPayloadMap } from "../types/websocket.js";
import { WS_EVENT_MAPPERS } from "../utils/mappers.js";
import { useDenshokanClient } from "./context.js";

export interface UseChannelOptions<C extends WSChannel> {
  gameIds?: number[];
  bufferSize?: number;
  enabled?: boolean;
  onEvent?: (event: WSChannelPayloadMap[C]) => void;
}

export interface UseChannelResult<C extends WSChannel> {
  lastEvent: WSChannelPayloadMap[C] | null;
  events: WSChannelPayloadMap[C][];
  isConnected: boolean;
  clear: () => void;
}

function useChannelSubscription<C extends WSChannel>(
  channel: C,
  options: UseChannelOptions<C> = {},
): UseChannelResult<C> {
  const { gameIds, bufferSize = 50, enabled = true, onEvent } = options;
  const client = useDenshokanClient();

  const [lastEvent, setLastEvent] = useState<WSChannelPayloadMap[C] | null>(null);
  const [events, setEvents] = useState<WSChannelPayloadMap[C][]>([]);
  const [isConnected, setIsConnected] = useState(client.wsConnected);

  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const bufferSizeRef = useRef(bufferSize);
  bufferSizeRef.current = bufferSize;

  const clear = useCallback(() => {
    setLastEvent(null);
    setEvents([]);
  }, []);

  // Track connection status
  useEffect(() => {
    const unsubscribe = client.onWsConnectionChange((connected) => {
      setIsConnected(connected);
    });
    return unsubscribe;
  }, [client]);

  // Subscribe to channel
  useEffect(() => {
    if (!enabled) return;

    client.connect();

    const unsubscribe = client.subscribe(
      { channels: [channel], gameIds },
      (message) => {
        if (message.channel !== channel) return;

        const mapper = WS_EVENT_MAPPERS[channel];
        const mapped = mapper(message.data as Record<string, unknown>) as WSChannelPayloadMap[C];

        setLastEvent(mapped);
        setEvents((prev) => {
          const next = [...prev, mapped];
          return next.length > bufferSizeRef.current
            ? next.slice(next.length - bufferSizeRef.current)
            : next;
        });

        onEventRef.current?.(mapped);
      },
    );

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, channel, enabled, JSON.stringify(gameIds)]);

  return { lastEvent, events, isConnected, clear };
}

export function useScoreUpdates(
  options?: UseChannelOptions<"scores">,
): UseChannelResult<"scores"> {
  return useChannelSubscription("scores", options);
}

export function useGameOverEvents(
  options?: UseChannelOptions<"game_over">,
): UseChannelResult<"game_over"> {
  return useChannelSubscription("game_over", options);
}

export function useMintEvents(
  options?: UseChannelOptions<"mints">,
): UseChannelResult<"mints"> {
  return useChannelSubscription("mints", options);
}

export function useTokenUpdates(
  options?: UseChannelOptions<"tokens">,
): UseChannelResult<"tokens"> {
  return useChannelSubscription("tokens", options);
}

export function useNewGames(
  options?: UseChannelOptions<"games">,
): UseChannelResult<"games"> {
  return useChannelSubscription("games", options);
}

export function useNewMinters(
  options?: UseChannelOptions<"minters">,
): UseChannelResult<"minters"> {
  return useChannelSubscription("minters", options);
}

export function useNewSettings(
  options?: UseChannelOptions<"settings">,
): UseChannelResult<"settings"> {
  return useChannelSubscription("settings", options);
}

export function useNewObjectives(
  options?: UseChannelOptions<"objectives">,
): UseChannelResult<"objectives"> {
  return useChannelSubscription("objectives", options);
}
