// Animated circular percentage gauge (SVG).
import { levelColor } from '../lib/format';

interface Props {
  percentage: number;
  active: boolean; // false when offline/fault -> muted ring
  size?: number;
}

export function GaugeRing({ percentage, active, size = 132 }: Props) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, percentage));
  const offset = c * (1 - pct / 100);
  const color = active ? levelColor(pct) : 'var(--text-faint)';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
         aria-label={`${pct.toFixed(0)} percent full`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--border)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1), stroke 0.3s' }}
      />
      <text
        x="50%"
        y="48%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize={size * 0.24}
        fontWeight={800}
        fill={active ? 'var(--text)' : 'var(--text-faint)'}
      >
        {active ? `${pct.toFixed(0)}` : '--'}
      </text>
      <text
        x="50%"
        y="66%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize={size * 0.1}
        fontWeight={700}
        fill="var(--text-faint)"
      >
        %
      </text>
    </svg>
  );
}
