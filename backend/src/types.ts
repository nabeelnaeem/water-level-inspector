// Shared data contract for the Water Level Inspector backend.
// These shapes are the single source of truth consumed by the web
// dashboard and the React Native app (mirror them client-side).

export type TankStatus = 'ok' | 'offline' | 'fault';

/** Persistent per-tank configuration. */
export interface TankConfig {
  /** Stable id, also used as the firmware `nodeId`. */
  id: string;
  label: string;
  /** Absolute internal height of the tank in cm. */
  heightCm: number;
  /** Sensor reading (cm) when the tank is completely full (offset). */
  maxLevelDistanceCm: number;
  /** Optional full capacity in litres — enables volume readouts. */
  capacityLiters: number | null;
  /** Display ordering / accent grouping. */
  sortOrder: number;
}

/** A single computed measurement persisted to the time-series. */
export interface TankReading {
  tankId: string;
  /** Raw distance from sensor in cm. `-1` means the sensor faulted. */
  rawDistanceCm: number;
  /** Distance after subtracting the max-level offset, clamped >= 0. */
  adjustedDistanceCm: number;
  /** 0–100. */
  percentage: number;
  /** Water column height in cm. */
  waterHeightCm: number;
  /** Estimated litres, or null when capacity is unknown. */
  volumeLiters: number | null;
  /** Wi-Fi RSSI reported by the node (dBm), if provided. */
  rssi: number | null;
  /** Firmware version string, if provided. */
  fw: string | null;
  /** Node uptime in seconds, if provided. */
  uptimeS: number | null;
  /** ISO-8601 timestamp the backend recorded the reading. */
  ts: string;
}

/** Current snapshot returned by GET /api/tanks. */
export interface TankState {
  config: TankConfig;
  latest: TankReading | null;
  status: TankStatus;
  /** ISO time of the most recent reading, or null if never seen. */
  lastSeen: string | null;
}

/** Payload the ESP32-S3 node POSTs to /api/ingest. */
export interface IngestPayload {
  nodeId: string;
  rawDistanceCm: number;
  rssi?: number;
  fw?: string;
  uptimeS?: number;
}
