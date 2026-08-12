'use client';

import React, { useEffect, useState } from 'react';
import { VaultChaseCard } from '@/components/futurecast/VaultChaseCard';
import { highPriorityToLabTarget } from '@/components/futurecast/lab/fc-lab-types';
import {
  fetchHighPriorityTargets,
  type HighPriorityPlayer,
} from '@/lib/futurecast-high-priority-api';
import { RECRUITING_TAB_PATHS } from '@/lib/vault-route-map';

export interface TargetBoardPreviewProps {
  classYear?: number;
  limit?: number;
  footerHref?: string;
  footerLabel?: string;
}

/**
 * Home "2028 UF Targets to watch" - chase-card v12 surface
 * (Current Class chrome + Why we chase), top of the priority board.
 */
export function TargetBoardPreview({
  classYear = 2028,
  limit = 6,
  footerHref = RECRUITING_TAB_PATHS['targets-2028'],
  footerLabel = 'Open 2028 chase board',
}: TargetBoardPreviewProps): React.ReactElement {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [boardCount, setBoardCount] = useState(0);
  const [players, setPlayers] = useState<HighPriorityPlayer[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const priority = await fetchHighPriorityTargets(classYear);
        if (cancelled) return;
        const ranked = priority.players ?? [];
        setPlayers(ranked.slice(0, limit));
        setBoardCount(priority.count ?? ranked.length);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load target board');
        setPlayers([]);
        setBoardCount(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [classYear, limit]);

  if (loading) {
    return <p className="fc-home-section__empty">Loading {classYear} targets…</p>;
  }
  if (error && !players.length) {
    return <p className="fc-home-section__empty">{error}</p>;
  }
  if (!players.length) {
    return <p className="fc-home-section__empty">No {classYear} UF targets loaded yet.</p>;
  }

  return (
    <>
      <div className="gv-chase-card-grid" data-testid="target-board-preview">
        {players.map((player, idx) => (
          <VaultChaseCard
            key={player.slug}
            player={highPriorityToLabTarget(player)}
            rank={idx + 1}
            showRace={idx === 0}
            profileContext="recruiting"
          />
        ))}
      </div>
      <a
        href={footerHref}
        className="home-targets-board-cta"
        data-testid="target-board-preview-cta"
      >
        <span className="home-targets-board-cta__copy">
          <span className="home-targets-board-cta__eyebrow">Priority board</span>
          <span className="home-targets-board-cta__title">{footerLabel}</span>
          <span className="home-targets-board-cta__meta">
            {boardCount > 0
              ? `${boardCount} ranked targets · why we chase`
              : 'Ranked by chase heat + fit'}
          </span>
        </span>
        <span className="home-targets-board-cta__chevron" aria-hidden="true">
          →
        </span>
      </a>
    </>
  );
}
