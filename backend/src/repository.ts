// Data-access layer: maps DB rows <-> domain types and computes tank state.
import { db } from './db.js';
import { config } from './config.js';
import { computeLevel } from './levelMath.js';
import type {
  IngestPayload,
  TankConfig,
  TankReading,
  TankState,
  TankStatus,
} from './types.js';

// ---- row shapes ----------------------------------------------------------

interface TankRow {
  id: string;
  label: string;
  height_cm: number;
  max_level_distance_cm: number;
  capacity_liters: number | null;
  sort_order: number;
}

interface ReadingRow {
  tank_id: string;
  raw_distance_cm: number;
  adjusted_distance_cm: number;
  percentage: number;
  water_height_cm: number;
  volume_liters: number | null;
  rssi: number | null;
  fw: string | null;
  uptime_s: number | null;
  fault: number;
  ts: string;
}

function toTankConfig(r: TankRow): TankConfig {
  return {
    id: r.id,
    label: r.label,
    heightCm: r.height_cm,
    maxLevelDistanceCm: r.max_level_distance_cm,
    capacityLiters: r.capacity_liters,
    sortOrder: r.sort_order,
  };
}

function toReading(r: ReadingRow): TankReading {
  return {
    tankId: r.tank_id,
    rawDistanceCm: r.raw_distance_cm,
    adjustedDistanceCm: r.adjusted_distance_cm,
    percentage: r.percentage,
    waterHeightCm: r.water_height_cm,
    volumeLiters: r.volume_liters,
    rssi: r.rssi,
    fw: r.fw,
    uptimeS: r.uptime_s,
    ts: r.ts,
  };
}

// ---- tanks ---------------------------------------------------------------

export function listTanks(): TankConfig[] {
  const rows = db
    .prepare('SELECT * FROM tanks ORDER BY sort_order, label')
    .all() as TankRow[];
  return rows.map(toTankConfig);
}

export function getTank(id: string): TankConfig | null {
  const row = db.prepare('SELECT * FROM tanks WHERE id = ?').get(id) as
    | TankRow
    | undefined;
  return row ? toTankConfig(row) : null;
}

export function upsertTank(t: TankConfig): TankConfig {
  db.prepare(
    `INSERT INTO tanks (id, label, height_cm, max_level_distance_cm, capacity_liters, sort_order)
     VALUES (@id, @label, @heightCm, @maxLevelDistanceCm, @capacityLiters, @sortOrder)
     ON CONFLICT(id) DO UPDATE SET
       label = excluded.label,
       height_cm = excluded.height_cm,
       max_level_distance_cm = excluded.max_level_distance_cm,
       capacity_liters = excluded.capacity_liters,
       sort_order = excluded.sort_order`,
  ).run(t);
  return getTank(t.id)!;
}

export function deleteTank(id: string): boolean {
  const res = db.prepare('DELETE FROM tanks WHERE id = ?').run(id);
  return res.changes > 0;
}

// ---- readings ------------------------------------------------------------

export function latestReading(tankId: string): TankReading | null {
  const row = db
    .prepare('SELECT * FROM readings WHERE tank_id = ? ORDER BY ts DESC, id DESC LIMIT 1')
    .get(tankId) as ReadingRow | undefined;
  return row ? toReading(row) : null;
}

/**
 * Record an incoming node reading. Computes the calibrated level using the
 * tank's config and persists it. Returns the stored reading, or null if the
 * nodeId doesn't map to a known tank.
 */
export function ingest(payload: IngestPayload): TankReading | null {
  const tank = getTank(payload.nodeId);
  if (!tank) return null;

  const level = computeLevel(payload.rawDistanceCm, tank);
  const ts = new Date().toISOString();

  db.prepare(
    `INSERT INTO readings
       (tank_id, raw_distance_cm, adjusted_distance_cm, percentage, water_height_cm,
        volume_liters, rssi, fw, uptime_s, fault, ts)
     VALUES (@tank_id, @raw, @adjusted, @percentage, @waterHeight,
        @volume, @rssi, @fw, @uptime, @fault, @ts)`,
  ).run({
    tank_id: tank.id,
    raw: level.rawDistanceCm,
    adjusted: level.adjustedDistanceCm,
    percentage: level.percentage,
    waterHeight: level.waterHeightCm,
    volume: level.volumeLiters,
    rssi: payload.rssi ?? null,
    fw: payload.fw ?? null,
    uptime: payload.uptimeS ?? null,
    fault: level.fault ? 1 : 0,
    ts,
  });

  return {
    tankId: tank.id,
    rawDistanceCm: level.rawDistanceCm,
    adjustedDistanceCm: level.adjustedDistanceCm,
    percentage: level.percentage,
    waterHeightCm: level.waterHeightCm,
    volumeLiters: level.volumeLiters,
    rssi: payload.rssi ?? null,
    fw: payload.fw ?? null,
    uptimeS: payload.uptimeS ?? null,
    ts,
  };
}

export interface HistoryPoint {
  ts: string;
  percentage: number;
  waterHeightCm: number;
  rawDistanceCm: number;
  fault: boolean;
}

/**
 * Return history for a tank over the last `minutes`. Points are returned at
 * full resolution up to `maxPoints`; only beyond that are they evenly
 * downsampled (so short, granular windows show every reading).
 */
export function history(tankId: string, minutes: number, maxPoints = 3000): HistoryPoint[] {
  // Compare against an ISO cutoff computed in JS. Stored `ts` values are
  // ISO strings (…Z), so lexicographic comparison is correct — whereas
  // SQLite's datetime('now') uses a space separator and would mis-compare.
  const cutoff = new Date(Date.now() - minutes * 60_000).toISOString();
  const rows = db
    .prepare(
      `SELECT raw_distance_cm, water_height_cm, percentage, fault, ts
         FROM readings
        WHERE tank_id = ? AND ts >= ?
        ORDER BY ts ASC`,
    )
    .all(tankId, cutoff) as ReadingRow[];

  // Even downsample to keep charts light without a window function.
  const step = Math.max(1, Math.ceil(rows.length / maxPoints));
  const out: HistoryPoint[] = [];
  for (let i = 0; i < rows.length; i += step) {
    const r = rows[i];
    out.push({
      ts: r.ts,
      percentage: r.percentage,
      waterHeightCm: r.water_height_cm,
      rawDistanceCm: r.raw_distance_cm,
      fault: !!r.fault,
    });
  }
  return out;
}

// ---- derived state -------------------------------------------------------

function deriveStatus(latest: TankReading | null): TankStatus {
  if (!latest) return 'offline';
  const ageMs = Date.now() - new Date(latest.ts).getTime();
  if (ageMs > config.offlineTimeoutMs) return 'offline';
  if (latest.rawDistanceCm < 0) return 'fault';
  return 'ok';
}

export function tankState(tank: TankConfig): TankState {
  const latest = latestReading(tank.id);
  return {
    config: tank,
    latest,
    status: deriveStatus(latest),
    lastSeen: latest?.ts ?? null,
  };
}

export function allTankStates(): TankState[] {
  return listTanks().map(tankState);
}
