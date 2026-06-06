import { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { HistoryPoint } from '@/api/types';

/** Fetches downsampled history for one tank over the last `hours`. */
export function useHistory(backendUrl: string, tankId: string, hours: number) {
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api
      .history(backendUrl, tankId, hours, controller.signal)
      .then((r) => {
        if (!controller.signal.aborted) setPoints(r.points);
      })
      .catch(() => {
        if (!controller.signal.aborted) setPoints([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [backendUrl, tankId, hours]);

  return { points, loading };
}
