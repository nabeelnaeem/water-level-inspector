// Mirrors the backend data contract (backend/src/types.ts). Keep in sync.

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

export interface HistoryResponse {
  tankId: string;
  minutes: number;
  points: HistoryPoint[];
}

// ---- fill tracking (mirror of backend/src/types.ts) ----

export interface FillSession {
  id: number;
  tankId: string;
  startedAt: string;
  endedAt: string | null;
  startPercentage: number | null;
  startWaterHeightCm: number | null;
}

export type FillStatus = 'no_session' | 'collecting' | 'filling' | 'stalled' | 'full';

export interface FillEstimate {
  status: FillStatus;
  session: FillSession | null;
  samples: number;
  currentPercentage: number | null;
  startPercentage: number | null;
  pctPerMin: number | null;
  cmPerMin: number | null;
  etaMinutes: number | null;
  etaAt: string | null;
}

export interface RateResult {
  windowMinutes: number;
  samples: number;
  spanMinutes: number | null;
  deltaCm: number | null;
  deltaPercentage: number | null;
  cmPerMin: number | null;
  firstTs: string | null;
  lastTs: string | null;
}

// WebSocket messages (backend -> client)
export type WsMessage =
  | { type: 'snapshot'; tanks: TankState[] }
  | { type: 'reading'; reading: TankReading; state: TankState };
