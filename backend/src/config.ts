// Runtime configuration loaded from environment (.env optional).
import 'dotenv/config';

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const v = Number(raw);
  return Number.isFinite(v) ? v : fallback;
}

function str(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw === undefined || raw.trim() === '' ? fallback : raw;
}

export const config = {
  port: num('PORT', 4000),
  host: str('HOST', '0.0.0.0'),
  dbPath: str('DB_PATH', './data/water.db'),
  /** Empty string disables ingest auth. */
  ingestKey: str('INGEST_KEY', ''),
  offlineTimeoutMs: num('OFFLINE_TIMEOUT_SECONDS', 90) * 1000,
  historyRetentionDays: num('HISTORY_RETENTION_DAYS', 90),
} as const;
