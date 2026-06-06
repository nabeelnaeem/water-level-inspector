import { useEffect, useState } from 'react';
import { relativeTime } from '../lib/format';

/** Self-ticking "Xs ago" label. */
export function LastUpdated({ iso }: { iso: string | null }) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="muted">Updated {relativeTime(iso)}</span>;
}
