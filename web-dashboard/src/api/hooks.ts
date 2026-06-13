// React Query hooks + live WebSocket integration.
import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { api, wsUrl } from './client';
import type { TankState, WsMessage } from './types';

const TANKS_KEY = ['tanks'] as const;

/** All tanks, kept fresh by polling AND the live WS stream below. */
export function useTanks() {
  return useQuery({
    queryKey: TANKS_KEY,
    queryFn: api.listTanks,
    // WS pushes updates; poll as a fallback in case the socket drops.
    refetchInterval: 30_000,
    staleTime: 5_000,
  });
}

export function useHistory(tankId: string, minutes: number) {
  return useQuery({
    queryKey: ['history', tankId, minutes],
    queryFn: () => api.history(tankId, minutes),
    // Refresh fine-grained views quickly, coarse ones less often.
    refetchInterval: minutes <= 360 ? 15_000 : 60_000,
  });
}

export function useSaveTank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.saveTank,
    onSuccess: () => qc.invalidateQueries({ queryKey: TANKS_KEY }),
  });
}

export function useDeleteTank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteTank,
    onSuccess: () => qc.invalidateQueries({ queryKey: TANKS_KEY }),
  });
}

export function useRefreshTank() {
  // The fresh reading arrives via the WebSocket stream, so no cache work here.
  return useMutation({ mutationFn: api.refreshTank });
}

/** Live fill-to-100% estimate for a tank's active session. */
export function useFillEstimate(tankId: string) {
  return useQuery({
    queryKey: ['fill', tankId],
    queryFn: () => api.fillEstimate(tankId),
    // Recompute often while filling; the WS reading handler also invalidates.
    refetchInterval: 10_000,
  });
}

export function useStartFill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.startFill,
    onSuccess: (data, tankId) => qc.setQueryData(['fill', tankId], data),
  });
}

export function useStopFill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.stopFill,
    onSuccess: (data, tankId) => qc.setQueryData(['fill', tankId], data),
  });
}

/** Net level change over a trailing window (the rise meter). */
export function useRate(tankId: string, minutes: number) {
  return useQuery({
    queryKey: ['rate', tankId, minutes],
    queryFn: () => api.rate(tankId, minutes),
    refetchInterval: 10_000,
  });
}

/**
 * Maintain a single WebSocket connection that patches the React Query cache
 * in place as readings arrive. Auto-reconnects with backoff.
 */
export function useLiveUpdates(onConnected?: (connected: boolean) => void) {
  const qc = useQueryClient();
  const onConnectedRef = useRef(onConnected);
  onConnectedRef.current = onConnected;

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const connect = () => {
      socket = new WebSocket(wsUrl());

      socket.onopen = () => {
        retry = 0;
        onConnectedRef.current?.(true);
      };

      socket.onmessage = (ev) => {
        let msg: WsMessage;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }

        if (msg.type === 'snapshot') {
          qc.setQueryData<TankState[]>(TANKS_KEY, msg.tanks);
        } else if (msg.type === 'reading') {
          qc.setQueryData<TankState[]>(TANKS_KEY, (prev) => {
            if (!prev) return [msg.state];
            const idx = prev.findIndex((t) => t.config.id === msg.state.config.id);
            if (idx === -1) return [...prev, msg.state];
            const next = prev.slice();
            next[idx] = msg.state;
            return next;
          });
          // Let open history charts + fill/rate readouts pick up the new point.
          qc.invalidateQueries({ queryKey: ['history', msg.reading.tankId] });
          qc.invalidateQueries({ queryKey: ['fill', msg.reading.tankId] });
          qc.invalidateQueries({ queryKey: ['rate', msg.reading.tankId] });
        }
      };

      socket.onclose = () => {
        onConnectedRef.current?.(false);
        if (closed) return;
        retry += 1;
        const delay = Math.min(1000 * 2 ** retry, 15_000);
        timer = setTimeout(connect, delay);
      };

      socket.onerror = () => socket?.close();
    };

    connect();
    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      socket?.close();
    };
  }, [qc]);
}
