'use client';

import React, { useEffect, useState } from 'react';
import { ClassicRecruitCard } from '@/components/vault/ClassicRecruitCard';
import { fromUnderclassmenTarget } from '@/lib/recruiting-card-adapters';
import { fetchFutureCastUnderclassmen } from '@/lib/futurecast-underclassmen-api';
import { RECRUITING_TAB_PATHS } from '@/lib/vault-route-map';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import { UiWarming } from '@/components/site/UiMessage';

type Props = {
  classYear?: number;
  limit?: number;
};

function sortProspects(
  a: RecruitingBoardPlayer,
  b: RecruitingBoardPlayer
): number {
  const scoreA = Number(a.ufProbability) || 0;
  const scoreB = Number(b.ufProbability) || 0;
  if (scoreB !== scoreA) return scoreB - scoreA;
  const na = a.natlRank ?? 9999;
  const nb = b.natlRank ?? 9999;
  return na - nb;
}

export function YoungerProspectsPanel({
  classYear = 2028,
  limit = 8,
}: Props): React.ReactElement {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
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
        const merged = [
          ...(bucket?.targets ?? []),
          ...(bucket?.earlyMovement ?? []),
          ...(bucket?.watchlist ?? []),
        ]
          .map(fromUnderclassmenTarget)
          .sort(sortProspects);
        const seen = new Set<string>();
        const unique = merged.filter((p) => {
          if (seen.has(p.slug)) return false;
          seen.add(p.slug);
          return true;
        });
        setTotal(unique.length);
        setPlayers(unique.slice(0, limit));
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load younger prospects');
        setPlayers([]);
        setTotal(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [classYear, limit]);

  return (
    <>
      <div className="rh-section-header">
        <div className="rh-section-title">Younger Prospects</div>
        <div className="rh-section-subtitle">
          {classYear} underclassmen on the Early Discovery watchboard.
        </div>
      </div>
      {loading ? (
        <div className="rh-hub-warming" role="status" aria-live="polite" aria-busy="true">
          <UiWarming hint={`Loading ${classYear} younger prospects…`} />
        </div>
      ) : !players.length ? (
        <section className="rh-card" data-testid="rh-younger-prospects">
          <p className="rh-empty">
            {error ? 'Could not load younger prospects.' : `No ${classYear} prospects loaded yet.`}
          </p>
        </section>
      ) : (
        <section data-testid="rh-younger-prospects">
          <div className="rh-younger-prospects-grid gv-rb-grid">
            {players.map((player) => (
              <ClassicRecruitCard key={player.slug} player={player} variant="target" />
            ))}
          </div>
          <p className="rh-section-footer">
            <a href={RECRUITING_TAB_PATHS['targets-2028']} className="rh-cc-link">
              Open {classYear} target board
              {total > players.length ? ` (${total} tracked)` : ''} 뿯↽
            </a>
          </p>
        </section>
      )}
    </>
  );
}
