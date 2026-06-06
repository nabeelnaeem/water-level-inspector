import { useState, useEffect, useCallback, useRef } from 'react';
import { api, toWsUrl } from '@/api/client';
import { TankState, WsMessage } from '@/api/types';

export interface TanksData {
  tanks: TankState[];
  connected: boolean;   // WebSocket live?
  isLoading: boolean;
  isRefreshing: boolean;
  lastUpdated: Date | null;
  error: string | null;
}

/**
 * Loads tanks from the backend and keeps them live via WebSocket, with a
 * polling fallback. Replaces the old direct-to-sensor `useTankData`.
 */
export function useTanks(
  backendUrl: string,
  refreshInterval: number,
): [TanksData, () => void] {
  const [data, setData] = useState<TanksData>({
    tanks: [],
    connected: false,
    isLoading: true,
    isRefreshing: false,
    lastUpdated: null,
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setData((prev) => ({ ...prev, isRefreshing: true, error: null }));
    try {
      const tanks = await api.listTanks(backendUrl, controller.signal);
      if (controller.signal.aborted) return;
      setData((prev) => ({
        ...prev,
        tanks,
        isLoading: false,
        isRefreshing: false,
        lastUpdated: new Date(),
        error: null,
      }));
    } catch (e) {
      if (controller.signal.aborted) return;
      setData((prev) => ({
        ...prev,
        isLoading: false,
        isRefreshing: false,
        error: `Cannot reach backend at ${backendUrl}`,
      }));
    }
  }, [backendUrl]);

  // Initial load + polling fallback.
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, refreshInterval);
    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [refresh, refreshInterval]);

  // Live WebSocket stream with auto-reconnect.
  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const applyState = (state: TankState) =>
      setData((prev) => {
        const idx = prev.tanks.findIndex((t) => t.config.id === state.config.id);
        const tanks =
          idx === -1
            ? [...prev.tanks, state]
            : prev.tanks.map((t, i) => (i === idx ? state : t));
        return { ...prev, tanks, lastUpdated: new Date() };
      });

    const connect = () => {
      try {
        socket = new WebSocket(toWsUrl(backendUrl));
      } catch {
        scheduleReconnect();
        return;
      }

      socket.onopen = () => {
        retry = 0;
        setData((prev) => ({ ...prev, connected: true }));
      };

      socket.onmessage = (ev) => {
        let msg: WsMessage;
        try {
          msg = JSON.parse(typeof ev.data === 'string' ? ev.data : '');
        } catch {
          return;
        }
        if (msg.type === 'snapshot') {
          setData((prev) => ({ ...prev, tanks: msg.tanks, lastUpdated: new Date() }));
        } else if (msg.type === 'reading') {
          applyState(msg.state);
        }
      };

      socket.onclose = () => {
        setData((prev) => ({ ...prev, connected: false }));
        scheduleReconnect();
      };

      socket.onerror = () => socket?.close();
    };

    const scheduleReconnect = () => {
      if (closed) return;
      retry += 1;
      const delay = Math.min(1000 * 2 ** retry, 15000);
      timer = setTimeout(connect, delay);
    };

    connect();
    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      socket?.close();
    };
  }, [backendUrl]);

  return [data, refresh];
}
