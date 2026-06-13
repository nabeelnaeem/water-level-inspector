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

// ---- fill tracking -------------------------------------------------------

/**
 * A "I'm filling this tank now" tracking session. Started/stopped from the
 * dashboard button. The fill ETA is computed only from readings recorded
 * between `startedAt` and now — never from previous sessions/days.
 */
export interface FillSession {
  id: number;
  tankId: string;
  /** ISO time the user pressed "Start tracking". */
  startedAt: string;
  /** ISO time the session was stopped, or null while active. */
  endedAt: string | null;
  /** Fill % at the moment tracking started (null if unknown). */
  startPercentage: number | null;
  /** Water height (cm) at the moment tracking started (null if unknown). */
  startWaterHeightCm: number | null;
}

export type FillStatus = 'no_session' | 'collecting' | 'filling' | 'stalled' | 'full';

/** Live projection of when the tank reaches 100%, for the active session. */
export interface FillEstimate {
  /**
   * no_session — nothing being tracked.
   * collecting — tracking, but <2 readings so far.
   * filling    — rising; etaMinutes/etaAt are populated.
   * stalled    — not rising; can't project an ETA.
   * full       — already at/above 100%.
   */
  status: FillStatus;
  session: FillSession | null;
  /** Number of readings used since the session started. */
  samples: number;
  /** Most recent fill % since the session started. */
  currentPercentage: number | null;
  /** Fill % when tracking started. */
  startPercentage: number | null;
  /** Fill speed from a least-squares fit (% per minute). */
  pctPerMin: number | null;
  /** Fill speed in cm per minute. */
  cmPerMin: number | null;
  /** Minutes until 100%, or null when not meaningfully rising. */
  etaMinutes: number | null;
  /** Absolute ISO time the tank is projected to hit 100%. */
  etaAt: string | null;
}

/**
 * Net level change over a trailing window — powers the "rise meter" and the
 * stall alarm. `deltaCm` > 0 means the level rose over the window.
 */
export interface RateResult {
  /** Requested window in minutes. */
  windowMinutes: number;
  /** Fault-free samples found in the window. */
  samples: number;
  /** Time actually spanned by those samples (<= windowMinutes), or null. */
  spanMinutes: number | null;
  /** Change in water height (cm) across the window. */
  deltaCm: number | null;
  /** Change in fill percentage across the window. */
  deltaPercentage: number | null;
  /** Average rise speed (cm per minute), or null. */
  cmPerMin: number | null;
  firstTs: string | null;
  lastTs: string | null;
}
