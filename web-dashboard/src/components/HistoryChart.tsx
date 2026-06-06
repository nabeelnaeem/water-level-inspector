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
  { label: '6h', hours: 6 },
  { label: '24h', hours: 24 },
  { label: '7d', hours: 24 * 7 },
  { label: '30d', hours: 24 * 30 },
];

export function HistoryChart({ tankId }: { tankId: string }) {
  const [hours, setHours] = useState(24);
  const { data, isLoading } = useHistory(tankId, hours);

  const points = (data?.points ?? []).map((p) => ({
    t: new Date(p.ts).getTime(),
    pct: p.fault ? null : p.percentage,
  }));

  const fmtX = (t: number) => {
    const d = new Date(t);
    return hours <= 24
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <strong style={{ fontSize: 14 }}>History</strong>
        <div className="row" style={{ gap: 4 }}>
          {RANGES.map((r) => (
            <button
              key={r.hours}
              onClick={() => setHours(r.hours)}
              className="pill"
              style={{
                cursor: 'pointer',
                border: '1px solid var(--border)',
                background: hours === r.hours ? 'var(--bg-elev-2)' : 'transparent',
                color: hours === r.hours ? 'var(--text)' : 'var(--text-faint)',
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
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-elev)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  color: 'var(--text)',
                }}
                labelFormatter={(t) => new Date(t as number).toLocaleString()}
                formatter={(v) => [`${v}%`, 'Level']}
              />
              <Area
                type="monotone"
                dataKey="pct"
                stroke="#00d4aa"
                strokeWidth={2}
                fill="url(#g)"
                connectNulls
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
