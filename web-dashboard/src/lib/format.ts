// Display formatters shared across components.
import type { TankStatus } from '../api/types';

export function relativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.round(diffMs / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function clockTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Accent color for a fill percentage (matches the mobile app palette). */
export function levelColor(pct: number): string {
  if (pct <= 15) return '#ff4d4f';
  if (pct <= 35) return '#ff8c00';
  return '#00d4aa';
}

export function statusColor(status: TankStatus): string {
  switch (status) {
    case 'ok':
      return '#00d4aa';
    case 'fault':
      return '#ff8c00';
    case 'offline':
      return '#ff4d4f';
  }
}

export function statusLabel(status: TankStatus): string {
  switch (status) {
    case 'ok':
      return 'Online';
    case 'fault':
      return 'Sensor fault';
    case 'offline':
      return 'Offline';
  }
}
