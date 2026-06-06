import { useTanks } from '../api/hooks';
import { TankCard } from '../components/TankCard';

export function Dashboard() {
  const { data: tanks, isLoading, isError, refetch } = useTanks();

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, letterSpacing: -0.5 }}>Dashboard</h1>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>
            Live water levels across all tanks
          </p>
        </div>
        <button className="btn" onClick={() => refetch()}>↻ Refresh</button>
      </div>

      {isLoading && <div className="muted">Connecting to backend…</div>}

      {isError && (
        <div className="banner err">
          Could not reach the backend. Is it running and on the same network?
          Check <code>VITE_API_BASE</code> or the backend host.
        </div>
      )}

      {tanks && tanks.length === 0 && (
        <div className="banner warn">
          No tanks configured yet. Add one in <strong>Settings</strong>, then point a node's
          <code> nodeId</code> at its id.
        </div>
      )}

      {tanks && tanks.length > 0 && (
        <div className="grid">
          {tanks.map((t) => (
            <TankCard key={t.config.id} tank={t} />
          ))}
        </div>
      )}
    </div>
  );
}
