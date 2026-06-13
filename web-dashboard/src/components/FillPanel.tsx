// Per-tank "filling tools": fill-to-100% ETA tracker, a trailing-window rise
// meter, and a stall alarm that rings when the level stops climbing.
import { useEffect, useState } from 'react';
import type { TankState } from '../api/types';
import { useFillEstimate, useStartFill, useStopFill, useRate } from '../api/hooks';
import { durationFromMinutes, clockTime } from '../lib/format';
import { ringAlarm, unlockAudio } from '../lib/alarm';

// Selectable rise-meter / alarm windows, 1 minute → 3 hours.
const RISE_WINDOWS = [
  { label: '1m', m: 1 },
  { label: '5m', m: 5 },
  { label: '15m', m: 15 },
  { label: '30m', m: 30 },
  { label: '1h', m: 60 },
  { label: '3h', m: 180 },
];

// Below this much rise over the window we consider the tank "not filling".
const STALL_THRESHOLD_CM = 0.5;
// How often to re-ring while a stall persists.
const ALARM_REPEAT_MS = 20_000;
// "Tank full" alarm rings near-continuously until the user acknowledges it.
const FULL_ALARM_REPEAT_MS = 2_500;

function fmtSigned(v: number | null, unit: string, dp = 1): string {
  if (v == null) return '—';
  const s = v > 0 ? '+' : '';
  return `${s}${v.toFixed(dp)} ${unit}`;
}

export function FillPanel({ tank }: { tank: TankState }) {
  const tankId = tank.config.id;
  const online = tank.status === 'ok';

  // ---- Feature 1: fill-to-100% tracking ----
  const fill = useFillEstimate(tankId);
  const startFill = useStartFill();
  const stopFill = useStopFill();
  const est = fill.data;
  const tracking = !!est?.session && est.status !== 'no_session';

  // ---- Feature 2: rise meter (and Feature 3 alarm window) ----
  const [windowMin, setWindowMin] = useState(5);
  const rate = useRate(tankId, windowMin);
  const r = rate.data;

  // ---- Feature 3: stall alarm ----
  const [alarmOn, setAlarmOn] = useState(false);

  // ---- "Tank full" alarm + auto-stop on 100% ----
  // Rings continuously once the tank fills, independent of the stall-alarm
  // toggle, until the user acknowledges it with the button.
  const [fullAlarmActive, setFullAlarmActive] = useState(false);
  const sessionId = est?.session?.id ?? null;

  // When the active session reaches 100%, auto-stop tracking and raise the full
  // alarm. Runs once per session — stopping clears the session so it can't loop.
  useEffect(() => {
    if (est?.status === 'full' && sessionId != null && !stopFill.isPending) {
      setFullAlarmActive(true);
      stopFill.mutate(tankId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [est?.status, sessionId]);

  // Ring continuously while the full alarm is active.
  useEffect(() => {
    if (!fullAlarmActive) return;
    ringAlarm();
    const id = setInterval(ringAlarm, FULL_ALARM_REPEAT_MS);
    return () => clearInterval(id);
  }, [fullAlarmActive]);

  // Only flag a stall once the samples actually cover most of the window, so we
  // don't false-alarm right after enabling it or changing the interval. The
  // full alarm takes precedence — a full tank plateaus and would look "stalled".
  const haveCoverage =
    !!r && r.samples >= 2 && r.spanMinutes != null && r.spanMinutes >= Math.max(1, windowMin * 0.6);
  const stalled =
    alarmOn && !fullAlarmActive && haveCoverage && (r!.deltaCm ?? 0) < STALL_THRESHOLD_CM;

  // Ring on entering a stall, then repeat until it clears or the alarm is off.
  useEffect(() => {
    if (!stalled) return;
    ringAlarm();
    const id = setInterval(ringAlarm, ALARM_REPEAT_MS);
    return () => clearInterval(id);
  }, [stalled]);

  const toggleAlarm = () => {
    unlockAudio(); // this click is the user gesture that enables audio
    setAlarmOn((on) => !on);
  };

  const handleStart = () => {
    unlockAudio(); // unlock audio now so the full alarm can ring later
    setFullAlarmActive(false); // clear any prior acknowledgement state
    startFill.mutate(tankId);
  };

  const rising = (r?.deltaCm ?? 0) > 0;
  const riseColor = !r || r.deltaCm == null ? 'var(--text-faint)' : rising ? 'var(--accent)' : '#ff8c00';

  return (
    <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14, display: 'grid', gap: 14 }}>
      {/* ---------- Tank-full alarm (rings until acknowledged) ---------- */}
      {fullAlarmActive && (
        <div
          className="banner"
          style={{
            marginBottom: 0,
            justifyContent: 'space-between',
            gap: 12,
            color: 'var(--accent)',
            borderColor: 'color-mix(in srgb, var(--accent) 45%, var(--border))',
            background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
          }}
        >
          <span style={{ fontWeight: 700 }}>🔔 Tank full (100%) — fill complete. Tracking stopped.</span>
          <button
            className="btn"
            style={{ padding: '6px 12px', flexShrink: 0 }}
            onClick={() => setFullAlarmActive(false)}
          >
            🔕 Stop alarm
          </button>
        </div>
      )}

      {/* ---------- Fill-to-100% tracker ---------- */}
      <div className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 200 }}>
          <span className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Fill estimate
          </span>
          <div style={{ marginTop: 4 }}>
            {!tracking && (
              <span className="muted" style={{ fontSize: 13 }}>Not tracking. Start when you begin filling.</span>
            )}
            {tracking && est?.status === 'collecting' && (
              <span style={{ fontSize: 13 }}>⏳ Collecting data… ({est.samples} reading{est.samples === 1 ? '' : 's'})</span>
            )}
            {tracking && est?.status === 'filling' && (
              <>
                <div style={{ fontSize: 18, fontWeight: 800 }}>
                  Full in {durationFromMinutes(est.etaMinutes)}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  ~{clockTime(est.etaAt)} · {fmtSigned(est.cmPerMin, 'cm/min', 2)}
                  {est.startPercentage != null && est.currentPercentage != null && (
                    <> · {est.startPercentage.toFixed(0)}% → {est.currentPercentage.toFixed(0)}%</>
                  )}
                </div>
              </>
            )}
            {tracking && est?.status === 'stalled' && (
              <span style={{ fontSize: 13, color: '#ff8c00' }}>
                ⚠ Level not rising — can't estimate. Supply off?
              </span>
            )}
            {tracking && est?.status === 'full' && (
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>Tank full 🎉</span>
            )}
          </div>
        </div>

        {tracking ? (
          <button
            className="btn danger"
            style={{ padding: '8px 14px' }}
            onClick={() => stopFill.mutate(tankId)}
            disabled={stopFill.isPending}
          >
            ■ Stop tracking
          </button>
        ) : (
          <button
            className="btn primary"
            style={{ padding: '8px 14px' }}
            onClick={handleStart}
            disabled={startFill.isPending || !online}
            title={online ? 'Start tracking the fill' : 'Tank offline'}
          >
            ▶ Start tracking
          </button>
        )}
      </div>

      {/* ---------- Rise meter + stall alarm ---------- */}
      <div>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
          <span className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Rise over last {RISE_WINDOWS.find((w) => w.m === windowMin)?.label ?? `${windowMin}m`}
          </span>
          <div className="row" style={{ gap: 4 }}>
            {RISE_WINDOWS.map((w) => (
              <button
                key={w.m}
                onClick={() => setWindowMin(w.m)}
                className="pill"
                style={{
                  cursor: 'pointer',
                  border: '1px solid var(--border)',
                  background: windowMin === w.m ? 'var(--bg-elev-2)' : 'transparent',
                  color: windowMin === w.m ? 'var(--text)' : 'var(--text-faint)',
                }}
              >
                {w.label}
              </button>
            ))}
            <button
              onClick={toggleAlarm}
              className="pill"
              title={alarmOn ? 'Stall alarm on — click to mute' : 'Ring an alarm if the level stops rising'}
              style={{
                cursor: 'pointer',
                border: '1px solid var(--border)',
                background: alarmOn ? 'color-mix(in srgb, var(--accent) 18%, transparent)' : 'transparent',
                color: alarmOn ? 'var(--accent)' : 'var(--text-faint)',
              }}
            >
              {alarmOn ? '🔔 Alarm on' : '🔕 Alarm'}
            </button>
          </div>
        </div>

        <div className="row" style={{ gap: 18, alignItems: 'baseline' }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: riseColor }}>
            {r && r.deltaCm != null ? `${r.deltaCm > 0 ? '▲' : r.deltaCm < 0 ? '▼' : ''} ${fmtSigned(r.deltaCm, 'cm')}` : '—'}
          </span>
          <span className="muted" style={{ fontSize: 13 }}>
            {r && r.cmPerMin != null ? `${fmtSigned(r.cmPerMin, 'cm/min', 2)}` : 'not enough data yet'}
            {r && r.deltaPercentage != null && <> · {fmtSigned(r.deltaPercentage, '%')}</>}
          </span>
        </div>

        {stalled && (
          <div className="banner err" style={{ marginTop: 12, marginBottom: 0 }}>
            🔔 No water detected — level rose under {STALL_THRESHOLD_CM} cm in the last{' '}
            {RISE_WINDOWS.find((w) => w.m === windowMin)?.label ?? `${windowMin}m`}. Check the supply.
          </div>
        )}
      </div>
    </div>
  );
}
