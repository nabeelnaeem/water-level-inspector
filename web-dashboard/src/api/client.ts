// REST client + base-URL resolution.
import type { HistoryResponse, TankState } from './types';

/**
 * Resolve the backend base URL.
 * Priority: VITE_API_BASE env → same hostname on :4000 (typical LAN host).
 */
export function apiBase(): string {
  const fromEnv = import.meta.env.VITE_API_BASE as string | undefined;
  if (fromEnv && fromEnv.trim()) return fromEnv.replace(/\/$/, '');
  const host = window.location.hostname || 'localhost';
  return `http://${host}:4000`;
}

export function wsUrl(): string {
  const base = apiBase();
  return base.replace(/^http/, 'ws') + '/ws';
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  return res.json() as Promise<T>;
}

export const api = {
  health: () => getJson<{ ok: boolean; ts: string }>('/api/health'),

  listTanks: () => getJson<{ tanks: TankState[] }>('/api/tanks').then((r) => r.tanks),

  getTank: (id: string) => getJson<TankState>(`/api/tanks/${encodeURIComponent(id)}`),

  history: (id: string, hours: number) =>
    getJson<HistoryResponse>(`/api/tanks/${encodeURIComponent(id)}/history?hours=${hours}`),

  saveTank: async (cfg: {
    id: string;
    label: string;
    heightCm: number;
    maxLevelDistanceCm: number;
    capacityLiters: number | null;
    sortOrder: number;
  }): Promise<TankState> => {
    const res = await fetch(`${apiBase()}/api/tanks/${encodeURIComponent(cfg.id)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cfg),
    });
    if (!res.ok) throw new Error(`Save failed: HTTP ${res.status}`);
    return res.json();
  },

  deleteTank: async (id: string): Promise<void> => {
    const res = await fetch(`${apiBase()}/api/tanks/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok && res.status !== 204) throw new Error(`Delete failed: HTTP ${res.status}`);
  },
};
