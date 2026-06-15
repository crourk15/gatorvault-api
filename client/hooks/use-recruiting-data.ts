'use client';

import { useEffect, useState } from 'react';
import { fetchRecruitingBoard, type TrackerPlayer } from '@/lib/tracker-api';

export function useRecruitingData(classYear = 2027, staffMode = false): {
  players: TrackerPlayer[];
  loading: boolean;
  error: string | null;
  updatedAt: string | null;
  reload: () => void;
} {
  const [players, setPlayers] = useState<TrackerPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchRecruitingBoard(classYear, staffMode)
      .then((data) => {
        if (cancelled) return;
        setPlayers(data.players);
        setUpdatedAt(data.updatedAt);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load recruiting board');
        setPlayers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [classYear, staffMode, reloadToken]);

  return {
    players,
    loading,
    error,
    updatedAt,
    reload: () => setReloadToken((n) => n + 1),
  };
}
