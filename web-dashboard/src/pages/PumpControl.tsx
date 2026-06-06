// Placeholder for the future automated tank-filling controller (Phase: future).
// Wired to the same backend; the relay endpoints don't exist yet, so this is
// intentionally a disabled preview that documents the planned safety logic.
import { useTanks } from '../api/hooks';

export function PumpControl() {
  const { data: tanks } = useTanks();

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 26, letterSpacing: -0.5 }}>Pump Automation</h1>
      <p className="muted" style={{ margin: '0 0 18px', fontSize: 14 }}>
        Coming soon — relay control with dry-run protection
      </p>

      <div className="banner warn">
        🚧 Not yet active. This panel previews the planned auto-fill controller. Add a relay node
        and the backend pump endpoints to enable it.
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 18 }}>
        <strong style={{ fontSize: 14 }}>Planned safety logic</strong>
        <ul className="dim" style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 0 }}>
          <li><strong>Dry-run prevention:</strong> lock the pump if the source (UG) tank is below threshold.</li>
          <li><strong>Auto-fill trigger:</strong> start when the destination tank drops below its low mark.</li>
          <li><strong>Auto-shutoff:</strong> stop at full, or if the source runs low.</li>
          <li><strong>Fail-safe:</strong> shut off immediately if any node goes offline or faults.</li>
          <li><strong>Manual override:</strong> on/off toggle here and in the mobile app.</li>
        </ul>
      </div>

      <div className="card" style={{ padding: 18, opacity: 0.6 }}>
        <strong style={{ fontSize: 14 }}>Pump status</strong>
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
          <span className="dim">Relay</span>
          <span className="pill" style={{ color: 'var(--text-faint)', background: 'var(--bg-elev-2)' }}>
            <span className="dot" style={{ background: 'var(--text-faint)' }} /> Offline
          </span>
        </div>
        <div className="row" style={{ gap: 12, marginTop: 16 }}>
          <button className="btn" disabled>Start pump</button>
          <button className="btn danger" disabled>Stop pump</button>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 14, marginBottom: 0 }}>
          {tanks?.length ?? 0} tank(s) currently monitored.
        </p>
      </div>
    </div>
  );
}
