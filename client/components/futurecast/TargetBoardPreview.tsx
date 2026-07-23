'use client';

import React, { useEffect, useState } from 'react';
import { ClassicRecruitCard } from '@/components/vault/ClassicRecruitCard';
import { fromUnderclassmenTarget, resolveCardVariant } from '@/lib/recruiting-card-adapters';
import { fetchFutureCastUnderclassmen } from '@/lib/futurecast-underclassmen-api';
import { fetchHighPriorityTargets } from '@/lib/futurecast-high-priority-api';
import { RECRUITING_TAB_PATHS } from '@/lib/vault-route-map';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';

export interface TargetBoardPreviewProps {
  classYear?: number;
  limit?: number;
  footerHref?: string;
  footerLabel?: string;
}

function sortTargets(a: RecruitingBoardPlayer, b: RecruitingBoardPlayer): number {
  // Keep UF commits visible, but don't let them bury the active chase board.
  const commitA = a.isCommittedToUF ? 1 : 0;
  const commitB = b.isCommittedToUF ? 1 : 0;
  if (commitA !== commitB) return commitA - commitB;
  const uf = (Number(b.ufProbability) || 0) - (Number(a.ufProbability) || 0);
  if (uf !== 0) return uf;
  const na = a.natlRank ?? 9999;
  const nb = b.natlRank ?? 9999;
  return na - nb;
}

export function TargetBoardPreview({
  classYear = 2028,
  limit = 6,
  footerHref = RECRUITING_TAB_PATHS['targets-2028'],
  footerLabel = 'Open 2028 chase board',
}: TargetBoardPreviewProps): React.ReactElement {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [boardCount, setBoardCount] = useState(0);
  const [players, setPlayers] = useState<RecruitingBoardPlayer[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [underclassmen, priority] = await Promise.all([
          fetchFutureCastUnderclassmen([classYear]),
          fetchHighPriorityTargets(classYear).catch(() => null),
        ]);
        if (cancelled) return;
        const bucket = underclassmen.classes[String(classYear)];
        const targets = (bucket?.targets ?? []).map(fromUnderclassmenTarget).sort(sortTargets);
        setPlayers(targets.slice(0, limit));
        // Destination board is the priority chase list (capped) — never the full class census.
        const destinationCount = priority?.count ?? priority?.players?.length ?? 0;
        setBoardCount(destinationCount > 0 ? destinationCount : Math.min(targets.length, limit));
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
      <div className="fc-home-card-grid gv-rb-grid" data-testid="target-board-preview">
        {players.map((player) => (
          <ClassicRecruitCard
            key={player.slug}
            player={player}
            variant={resolveCardVariant(player)}
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
              ? `${boardCount} ranked targets · likelihood + fit`
              : 'Ranked by likelihood + fit'}
          </span>
        </span>
        <span className="home-targets-board-cta__chevron" aria-hidden="true">
          →
        </span>
      </a>
    </>
  );
}
