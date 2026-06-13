// Pure math for fill-rate estimation and trailing-window rate-of-change.
// Kept side-effect-free so it can be unit-tested and reused by clients.
import type { FillEstimate, FillSession, RateResult } from './types.js';

/** A fault-free reading reduced to the fields the math needs. */
export interface Sample {
  /** Epoch milliseconds of the reading. */
  tMs: number;
  /** 0–100 fill percentage. */
  pct: number;
  /** Water column height in cm. */
  cm: number;
}

const round = (v: number, dp: number): number => {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
};

/** Least-squares slope of y over x (per unit x). Returns 0 when undefined. */
function slope(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i];
    sy += ys[i];
    sxx += xs[i] * xs[i];
    sxy += xs[i] * ys[i];
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return 0;
  return (n * sxy - sx * sy) / denom;
}

/**
 * Net change of water height/level across a set of trailing-window samples.
 * Compares the earliest sample in the window to the latest one. A positive
 * `deltaCm` means the level rose; negative means it fell.
 */
export function computeRate(samples: Sample[], windowMinutes: number): RateResult {
  const firstTs = samples.length ? new Date(samples[0].tMs).toISOString() : null;
  const lastTs = samples.length ? new Date(samples[samples.length - 1].tMs).toISOString() : null;

  if (samples.length < 2) {
    return {
      windowMinutes,
      samples: samples.length,
      spanMinutes: null,
      deltaCm: null,
      deltaPercentage: null,
      cmPerMin: null,
      firstTs,
      lastTs,
    };
  }

  const first = samples[0];
  const last = samples[samples.length - 1];
  const spanMinutes = (last.tMs - first.tMs) / 60_000;
  const deltaCm = last.cm - first.cm;
  const deltaPercentage = last.pct - first.pct;
  const cmPerMin = spanMinutes > 0 ? deltaCm / spanMinutes : null;

  return {
    windowMinutes,
    samples: samples.length,
    spanMinutes: round(spanMinutes, 2),
    deltaCm: round(deltaCm, 2),
    deltaPercentage: round(deltaPercentage, 1),
    cmPerMin: cmPerMin != null ? round(cmPerMin, 3) : null,
    firstTs,
    lastTs,
  };
}

/**
 * Project when a filling tank reaches 100%, using ONLY the samples collected
 * since the session started (no history from previous days). The fill speed
 * comes from a least-squares fit, which tolerates the sensor's jitter better
 * than a naive first-vs-last delta.
 */
export function computeFillEstimate(
  session: FillSession | null,
  samples: Sample[],
  nowMs: number,
): FillEstimate {
  const base = {
    session,
    samples: samples.length,
    startPercentage: session?.startPercentage ?? null,
    currentPercentage: samples.length ? samples[samples.length - 1].pct : session?.startPercentage ?? null,
    pctPerMin: null as number | null,
    cmPerMin: null as number | null,
    etaMinutes: null as number | null,
    etaAt: null as string | null,
  };

  if (!session) return { ...base, status: 'no_session' };

  // Need at least two readings since the button press to infer a rate.
  if (samples.length < 2) return { ...base, status: 'collecting' };

  const current = samples[samples.length - 1].pct;

  // Already full — nothing left to estimate.
  if (current >= 99.5) {
    return { ...base, status: 'full', currentPercentage: current, etaMinutes: 0, etaAt: new Date(nowMs).toISOString() };
  }

  const t0 = samples[0].tMs;
  const xs = samples.map((s) => (s.tMs - t0) / 60_000); // minutes since first sample
  const pctPerMin = slope(xs, samples.map((s) => s.pct));
  const cmPerMin = slope(xs, samples.map((s) => s.cm));

  // Flat or draining → no meaningful ETA.
  if (pctPerMin <= 0) {
    return {
      ...base,
      status: 'stalled',
      currentPercentage: current,
      pctPerMin: round(pctPerMin, 3),
      cmPerMin: round(cmPerMin, 3),
    };
  }

  const etaMinutes = (100 - current) / pctPerMin;
  return {
    ...base,
    status: 'filling',
    currentPercentage: current,
    pctPerMin: round(pctPerMin, 3),
    cmPerMin: round(cmPerMin, 3),
    etaMinutes: round(etaMinutes, 1),
    etaAt: new Date(nowMs + etaMinutes * 60_000).toISOString(),
  };
}
