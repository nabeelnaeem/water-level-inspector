// THE single source of truth for tank-level math. Both the LCD master and
// the mobile app historically duplicated this; the backend now owns it and
// clients render the computed values it returns.

import type { TankConfig } from './types.js';

export interface ComputedLevel {
  rawDistanceCm: number;
  adjustedDistanceCm: number;
  percentage: number;
  waterHeightCm: number;
  volumeLiters: number | null;
  /** True when the reading is unusable (sensor timeout / out of range). */
  fault: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Convert a raw sensor distance into a calibrated tank level.
 *
 * Calibration model (matches the original Arduino sketch):
 *   adjusted   = max(0, raw - maxLevelDistance)
 *   waterHeight = height - adjusted
 *   percentage  = clamp((height - adjusted) / height * 100, 0, 100)
 *
 * A raw value < 0 is the firmware's "sensor faulted" sentinel. Unlike the
 * original code (which silently reported a faulted sensor as 100% full),
 * we surface it as a fault so downstream pump automation can fail safe.
 */
export function computeLevel(rawDistanceCm: number, tank: TankConfig): ComputedLevel {
  if (rawDistanceCm < 0 || !Number.isFinite(rawDistanceCm)) {
    return {
      rawDistanceCm,
      adjustedDistanceCm: -1,
      percentage: 0,
      waterHeightCm: 0,
      volumeLiters: null,
      fault: true,
    };
  }

  const adjusted = Math.max(0, rawDistanceCm - tank.maxLevelDistanceCm);
  const waterHeightCm = clamp(tank.heightCm - adjusted, 0, tank.heightCm);
  const percentage = clamp((waterHeightCm / tank.heightCm) * 100, 0, 100);
  const volumeLiters =
    tank.capacityLiters != null ? (percentage / 100) * tank.capacityLiters : null;

  return {
    rawDistanceCm,
    adjustedDistanceCm: adjusted,
    percentage: Math.round(percentage * 10) / 10,
    waterHeightCm: Math.round(waterHeightCm * 10) / 10,
    volumeLiters: volumeLiters != null ? Math.round(volumeLiters) : null,
    fault: false,
  };
}
