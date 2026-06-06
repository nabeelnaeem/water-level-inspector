// REST client for the backend. All calls take an explicit `baseUrl` (sourced
// from the user's stored config) so the app can point at any LAN host.
import { HistoryPoint, TankState } from './types';

function normalize(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

/** Derive the WebSocket URL from the REST base URL. */
export function toWsUrl(baseUrl: string): string {
  return normalize(baseUrl).replace(/^http/, 'ws') + '/ws';
}

async function getJson<T>(baseUrl: string, path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${normalize(baseUrl)}${path}`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  health: (baseUrl: string, signal?: AbortSignal) =>
    getJson<{ ok: boolean; ts: string }>(baseUrl, '/api/health', signal),

  listTanks: (baseUrl: string, signal?: AbortSignal) =>
    getJson<{ tanks: TankState[] }>(baseUrl, '/api/tanks', signal).then((r) => r.tanks),

  history: (baseUrl: string, tankId: string, hours: number, signal?: AbortSignal) =>
    getJson<{ tankId: string; hours: number; points: HistoryPoint[] }>(
      baseUrl,
      `/api/tanks/${encodeURIComponent(tankId)}/history?hours=${hours}`,
      signal,
    ),

  // Ask a node to take a fresh reading now (served within its command-poll
  // interval, ~3s). The result arrives via the normal WebSocket stream.
  refreshTank: async (baseUrl: string, tankId: string): Promise<void> => {
    const res = await fetch(
      `${normalize(baseUrl)}/api/tanks/${encodeURIComponent(tankId)}/refresh`,
      { method: 'POST' },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  },
};
