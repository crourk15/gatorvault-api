'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchNilEliteBundle, type NilEliteBundle } from '@/lib/nil-elite-api';
import { NIL_HUB_SEED } from '@/lib/nil-hub-seed';

export type NilEliteData = {
  bundle: NilEliteBundle | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

const SEED_ELITE: NilEliteBundle | null =
  (NIL_HUB_SEED as unknown as { elite?: NilEliteBundle })?.elite?.marketBoard
    ? ((NIL_HUB_SEED as unknown as { elite: NilEliteBundle }).elite)
    : null;

export function useNilEliteData(): NilEliteData {
  const [bundle, setBundle] = useState<NilEliteBundle | null>(SEED_ELITE);
  const [loading, setLoading] = useState(!SEED_ELITE);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!SEED_ELITE) setLoading(true);
    setError(null);
    try {
      const next = await fetchNilEliteBundle();
      setBundle(next);
    } catch (err) {
      if (!SEED_ELITE) {
        setError(err instanceof Error ? err.message : 'Could not load NIL tracker.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { bundle, loading, error, reload: load };
}
