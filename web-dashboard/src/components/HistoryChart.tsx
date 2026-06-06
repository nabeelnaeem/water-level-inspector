// History line chart (Recharts) with a time-range selector.
import { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useHistory } from '../api/hooks';

const RANGES = [
  { label: '15m', minutes: 15 },
  { label: '1h', minutes: 60 },
  { label: '6h', minutes: 360 },
  { label: '24h', minutes: 1440 },
  { label: '7d', minutes: 1440 * 7 },
  { label: '30d', minutes: 1440 * 30 },
];

// Tooltip showing both the level (%) and the water height (cm) for a point.
function ChartTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload as { t: number; pct: number | null; cm: number | null };
  return (
    <div
      style={{
        background: 'var(--bg-elev)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        color: 'var(--text)',
        padding: '8px 10px',
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      <div style={{ color: 'var(--text-faint)' }}>{new Date(d.t).toLocaleString()}</div>
      <div style={{ color: '#00d4aa', fontWeight: 700 }}>
        Level: {d.pct == null ? '—' : `${d.pct}%`}
      </div>
      <div style={{ fontWeight: 600 }}>
        Water height: {d.cm == null ? '—' : `${d.cm.toFixed(1)} cm`}
      </div>
    </div>
  );
}

export function HistoryChart({ tankId }: { tankId: string }) {
  const [minutes, setMinutes] = useState(60);
  const { data, isLoading } = useHistory(tankId, minutes);

  const points = (data?.points ?? []).map((p) => ({
    t: new Date(p.ts).getTime(),
    pct: p.fault ? null : p.percentage,
    cm: p.fault ? null : p.waterHeightCm,
  }));

  // Show a dot per reading on granular views so each data point is visible.
  const showDots = points.length > 0 && points.length <= 80;

  const fmtX = (t: number) => {
    const d = new Date(t);
    if (minutes <= 60) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (minutes <= 1440) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <strong style={{ fontSize: 14 }}>History</strong>
        <div className="row" style={{ gap: 4 }}>
          {RANGES.map((r) => (
            <button
              key={r.minutes}
              onClick={() => setMinutes(r.minutes)}
              className="pill"
              style={{
                cursor: 'pointer',
                border: '1px solid var(--border)',
                background: minutes === r.minutes ? 'var(--bg-elev-2)' : 'transparent',
                color: minutes === r.minutes ? 'var(--text)' : 'var(--text-faint)',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ height: 180 }}>
        {isLoading ? (
          <div className="muted" style={{ padding: 20 }}>Loading…</div>
        ) : points.length === 0 ? (
          <div className="muted" style={{ padding: 20 }}>No data in this range yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00d4aa" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#00d4aa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={fmtX}
                stroke="var(--text-faint)"
                fontSize={11}
                minTickGap={40}
              />
              <YAxis domain={[0, 100]} stroke="var(--text-faint)" fontSize={11} width={36} />
              <Tooltip content={ChartTooltip} />
              <Area
                type="monotone"
                dataKey="pct"
                stroke="#00d4aa"
                strokeWidth={2}
                fill="url(#g)"
                connectNulls
                isAnimationActive={false}
                dot={showDots ? { r: 2.5, fill: '#00d4aa', strokeWidth: 0 } : false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
