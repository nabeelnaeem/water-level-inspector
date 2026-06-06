// A single tank: gauge, key metrics, status, and expandable history.
import { useState } from 'react';
import type { TankState } from '../api/types';
import { GaugeRing } from './GaugeRing';
import { StatusBadge } from './StatusBadge';
import { LastUpdated } from './LastUpdated';
import { HistoryChart } from './HistoryChart';

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </span>
      <span style={{ fontSize: 15, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

export function TankCard({ tank }: { tank: TankState }) {
  const [open, setOpen] = useState(false);
  const { config, latest, status } = tank;
  const active = status === 'ok';

  const pct = latest && active ? latest.percentage : 0;
  const waterHeight = latest && active ? latest.waterHeightCm : null;
  const dist = latest && active ? latest.adjustedDistanceCm : null;
  const volume = latest && active ? latest.volumeLiters : null;

  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <strong style={{ fontSize: 16, letterSpacing: -0.2 }}>{config.label}</strong>
        <StatusBadge status={status} />
      </div>

      <div className="row" style={{ gap: 18, marginTop: 8 }}>
        <GaugeRing percentage={pct} active={active} />
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 14,
            alignContent: 'center',
          }}
        >
          <Metric label="Water height" value={waterHeight != null ? `${waterHeight.toFixed(1)} cm` : '—'} />
          <Metric label="Sensor dist" value={dist != null ? `${dist.toFixed(1)} cm` : '—'} />
          <Metric label="Tank height" value={`${config.heightCm} cm`} />
          <Metric
            label="Volume"
            value={volume != null ? `${volume} L` : config.capacityLiters ? '—' : 'n/a'}
          />
        </div>
      </div>

      {status === 'fault' && (
        <div className="banner warn" style={{ marginTop: 14, marginBottom: 0 }}>
          ⚠ Sensor reported a fault (no valid echo). Check wiring / blind zone.
        </div>
      )}
      {status === 'offline' && (
        <div className="banner err" style={{ marginTop: 14, marginBottom: 0 }}>
          ✕ Node offline — no readings recently.
        </div>
      )}

      <div className="row" style={{ justifyContent: 'space-between', marginTop: 14 }}>
        <span style={{ fontSize: 12 }}>
          <LastUpdated iso={tank.lastSeen} />
          {latest?.rssi != null && active && (
            <span className="muted"> · {latest.rssi} dBm</span>
          )}
        </span>
        <button
          className="pill"
          style={{ border: '1px solid var(--border)', color: 'var(--text-dim)', cursor: 'pointer' }}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? 'Hide history ▲' : 'Show history ▼'}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <HistoryChart tankId={config.id} />
        </div>
      )}
    </div>
  );
}
