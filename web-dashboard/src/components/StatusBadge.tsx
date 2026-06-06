import type { TankStatus } from '../api/types';
import { statusColor, statusLabel } from '../lib/format';

export function StatusBadge({ status }: { status: TankStatus }) {
  const color = statusColor(status);
  return (
    <span className="pill" style={{ color, background: `${color}1f` }}>
      <span className="dot" style={{ background: color }} />
      {statusLabel(status)}
    </span>
  );
}
