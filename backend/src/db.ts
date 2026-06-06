// SQLite setup (better-sqlite3, synchronous — perfect for a single-host LAN API).
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.js';

// Ensure the data directory exists before opening the file.
const dir = dirname(config.dbPath);
if (dir && dir !== '.' && !existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS tanks (
    id                  TEXT PRIMARY KEY,
    label               TEXT NOT NULL,
    height_cm           REAL NOT NULL,
    max_level_distance_cm REAL NOT NULL DEFAULT 0,
    capacity_liters     REAL,
    sort_order          INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS readings (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    tank_id             TEXT NOT NULL REFERENCES tanks(id) ON DELETE CASCADE,
    raw_distance_cm     REAL NOT NULL,
    adjusted_distance_cm REAL NOT NULL,
    percentage          REAL NOT NULL,
    water_height_cm     REAL NOT NULL,
    volume_liters       REAL,
    rssi                INTEGER,
    fw                  TEXT,
    uptime_s            INTEGER,
    fault               INTEGER NOT NULL DEFAULT 0,
    ts                  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_readings_tank_ts ON readings (tank_id, ts);
`);

/** Prune readings older than the retention window. No-op when retention = 0. */
export function pruneOldReadings(): number {
  if (config.historyRetentionDays <= 0) return 0;
  // ISO cutoff computed in JS so it lexicographically matches stored ISO `ts`
  // (SQLite's datetime('now') uses a space separator and would mis-compare).
  const cutoff = new Date(Date.now() - config.historyRetentionDays * 86_400_000).toISOString();
  const res = db.prepare(`DELETE FROM readings WHERE ts < ?`).run(cutoff);
  return res.changes;
}
