// Mirrors the backend data contract (backend/src/types.ts) and the web
// dashboard's api/types.ts. Keep all three in sync.

export type TankStatus = 'ok' | 'offline' | 'fault';

export interface TankConfig {
  id: string;
  label: string;
  heightCm: number;
  maxLevelDistanceCm: number;
  capacityLiters: number | null;
  sortOrder: number;
}

export interface TankReading {
  tankId: string;
  rawDistanceCm: number;
  adjustedDistanceCm: number;
  percentage: number;
  waterHeightCm: number;
  volumeLiters: number | null;
  rssi: number | null;
  fw: string | null;
  uptimeS: number | null;
  ts: string;
}

export interface TankState {
  config: TankConfig;
  latest: TankReading | null;
  status: TankStatus;
  lastSeen: string | null;
}

export interface HistoryPoint {
  ts: string;
  percentage: number;
  waterHeightCm: number;
  rawDistanceCm: number;
  fault: boolean;
}

export type WsMessage =
  | { type: 'snapshot'; tanks: TankState[] }
  | { type: 'reading'; reading: TankReading; state: TankState };
