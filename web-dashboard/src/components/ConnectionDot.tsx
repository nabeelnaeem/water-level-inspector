// Live WebSocket connection indicator for the app bar.
export function ConnectionDot({ connected }: { connected: boolean }) {
  const color = connected ? '#00d4aa' : '#ff8c00';
  return (
    <span className="pill" style={{ color, background: `${color}1f` }} title="Live connection">
      <span
        className="dot"
        style={{
          background: color,
          boxShadow: connected ? `0 0 0 0 ${color}` : 'none',
          animation: connected ? 'pulse 2s infinite' : 'none',
        }}
      />
      {connected ? 'Live' : 'Reconnecting'}
    </span>
  );
}
