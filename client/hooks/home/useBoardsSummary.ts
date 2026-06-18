'use client';

import { useEffect, useState } from 'react';
import { fetchHomeBoardsPreview } from '@/lib/vault-home-api';

export type BoardSummary = {
  classYear: number;
  rank: number | string;
  blueChipPercent: number | null;
  commitCount: number;
};

export function useBoardsSummary(): BoardSummary[] | null {
  const [boards, setBoards] = useState<BoardSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetchHomeBoardsPreview()
      .then((rows) => {
        if (cancelled) return;
        setBoards(
          rows.map((b) => ({
            classYear: b.year,
            rank: b.classRank ?? '—',
            blueChipPercent: b.blueChipPct,
            commitCount: b.commitCount,
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setBoards([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return boards;
}
