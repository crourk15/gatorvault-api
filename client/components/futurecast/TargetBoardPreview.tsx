'use client';

import React, { useEffect, useState } from 'react';
import { ClassicRecruitCard } from '@/components/vault/ClassicRecruitCard';
import { fromUnderclassmenTarget } from '@/lib/recruiting-card-adapters';
import { fetchFutureCastUnderclassmen } from '@/lib/futurecast-underclassmen-api';
import { RECRUITING_TAB_PATHS } from '@/lib/vault-route-map';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';

export interface TargetBoardPreviewProps {
  classYear?: number;
  limit?: number;
  footerHref?: string;
  footerLabel?: string;
}

function sortTargets(
  a: RecruitingBoardPlayer,
  b: RecruitingBoardPlayer
): number {
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
  footerLabel = 'Open 2028 target board →',
}: TargetBoardPreviewProps): React.ReactElement {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [players, setPlayers] = useState<RecruitingBoardPlayer[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchFutureCastUnderclassmen([classYear]);
        if (cancelled) return;
        const bucket = data.classes[String(classYear)];
        const targets = (bucket?.targets ?? []).map(fromUnderclassmenTarget).sort(sortTargets);
        setCount(targets.length);
        setPlayers(targets.slice(0, limit));
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load target board');
        setPlayers([]);
        setCount(0);
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
          <ClassicRecruitCard key={player.slug} player={player} variant="target" />
        ))}
      </div>
      <p className="fc-home-section__footer-link">
        <a href={footerHref}>
          {footerLabel}
          {count > players.length ? ` (${count} total)` : ''}
        </a>
      </p>
    </>
  );
}
