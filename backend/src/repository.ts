// Data-access layer: maps DB rows <-> domain types and computes tank state.
import { db } from './db.js';
import { config } from './config.js';
import { computeLevel } from './levelMath.js';
import { computeFillEstimate, computeRate, type Sample } from './fillStats.js';
import type {
  FillEstimate,
  FillSession,
  IngestPayload,
  RateResult,
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

// ---- fill tracking -------------------------------------------------------

interface FillSessionRow {
  id: number;
  tank_id: string;
  started_at: string;
  ended_at: string | null;
  start_percentage: number | null;
  start_water_height_cm: number | null;
}

function toFillSession(r: FillSessionRow): FillSession {
  return {
    id: r.id,
    tankId: r.tank_id,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    startPercentage: r.start_percentage,
    startWaterHeightCm: r.start_water_height_cm,
  };
}

function getFillSessionById(id: number | bigint): FillSession | null {
  const row = db.prepare('SELECT * FROM fill_sessions WHERE id = ?').get(id) as
    | FillSessionRow
    | undefined;
  return row ? toFillSession(row) : null;
}

/** The currently-open (not yet stopped) fill session for a tank, if any. */
export function getActiveFillSession(tankId: string): FillSession | null {
  const row = db
    .prepare(
      'SELECT * FROM fill_sessions WHERE tank_id = ? AND ended_at IS NULL ORDER BY started_at DESC, id DESC LIMIT 1',
    )
    .get(tankId) as FillSessionRow | undefined;
  return row ? toFillSession(row) : null;
}

/**
 * Begin tracking a fill. Closes any session already open for this tank so
 * there is at most one active session, then snapshots the current level as
 * the baseline.
 */
export function startFillSession(tankId: string): FillSession {
  const now = new Date().toISOString();
  db.prepare('UPDATE fill_sessions SET ended_at = ? WHERE tank_id = ? AND ended_at IS NULL').run(
    now,
    tankId,
  );

  const latest = latestReading(tankId);
  const usable = latest && latest.rawDistanceCm >= 0;
  const info = db
    .prepare(
      `INSERT INTO fill_sessions (tank_id, started_at, ended_at, start_percentage, start_water_height_cm)
       VALUES (?, ?, NULL, ?, ?)`,
    )
    .run(tankId, now, usable ? latest!.percentage : null, usable ? latest!.waterHeightCm : null);

  return getFillSessionById(info.lastInsertRowid)!;
}

/** Stop the active fill session for a tank. Returns it, or null if none open. */
export function stopFillSession(tankId: string): FillSession | null {
  const active = getActiveFillSession(tankId);
  if (!active) return null;
  db.prepare('UPDATE fill_sessions SET ended_at = ? WHERE id = ?').run(
    new Date().toISOString(),
    active.id,
  );
  return getFillSessionById(active.id);
}

/** Fault-free samples for a tank with `ts >= sinceIso`, oldest first. */
function samplesSince(tankId: string, sinceIso: string): Sample[] {
  const rows = db
    .prepare(
      `SELECT water_height_cm, percentage, ts
         FROM readings
        WHERE tank_id = ? AND ts >= ? AND fault = 0
        ORDER BY ts ASC`,
    )
    .all(tankId, sinceIso) as Pick<ReadingRow, 'water_height_cm' | 'percentage' | 'ts'>[];
  return rows.map((r) => ({
    tMs: new Date(r.ts).getTime(),
    pct: r.percentage,
    cm: r.water_height_cm,
  }));
}

/** Live fill-to-100% estimate for the tank's active session (if any). */
export function fillEstimate(tankId: string): FillEstimate {
  const session = getActiveFillSession(tankId);
  if (!session) return computeFillEstimate(null, [], Date.now());
  return computeFillEstimate(session, samplesSince(tankId, session.startedAt), Date.now());
}

/** Net level change over the last `minutes` (for the rise meter + alarm). */
export function rateOverWindow(tankId: string, minutes: number): RateResult {
  const cutoff = new Date(Date.now() - minutes * 60_000).toISOString();
  return computeRate(samplesSince(tankId, cutoff), minutes);
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
