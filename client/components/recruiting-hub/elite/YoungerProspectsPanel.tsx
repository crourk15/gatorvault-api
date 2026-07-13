'use client';

import React, { useEffect, useState } from 'react';
import { ClassicRecruitCard } from '@/components/vault/ClassicRecruitCard';
import { fromUnderclassmenTarget } from '@/lib/recruiting-card-adapters';
import { fetchFutureCastUnderclassmen } from '@/lib/futurecast-underclassmen-api';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import { UiWarming } from '@/components/site/UiMessage';

/** Younger Prospects = next cycles only (not the locked 2028 board). */
export const YOUNGER_PROSPECT_YEARS = [2029, 2030] as const;

const EARLY_DISCOVERY_HREF = '/vault/futurecast/big-board';

type Props = {
  years?: readonly number[];
  limit?: number;
};

function sortProspects(a: RecruitingBoardPlayer, b: RecruitingBoardPlayer): number {
  const yearA = Number(a.classYear) || 9999;
  const yearB = Number(b.classYear) || 9999;
  if (yearA !== yearB) return yearA - yearB;
  const scoreA = Number(a.ufProbability) || 0;
  const scoreB = Number(b.ufProbability) || 0;
  if (scoreB !== scoreA) return scoreB - scoreA;
  const na = a.natlRank ?? 9999;
  const nb = b.natlRank ?? 9999;
  return na - nb;
}

export function YoungerProspectsPanel({
  years = YOUNGER_PROSPECT_YEARS,
  limit = 8,
}: Props): React.ReactElement {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [players, setPlayers] = useState<RecruitingBoardPlayer[]>([]);
  const yearLabel = years.length === 1 ? String(years[0]) : `${years[0]}–${years[years.length - 1]}`;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchFutureCastUnderclassmen([...years]);
        if (cancelled) return;
        const merged = years
          .flatMap((year) => {
            const bucket = data.classes[String(year)];
            return [
              ...(bucket?.targets ?? []),
              ...(bucket?.earlyMovement ?? []),
              ...(bucket?.watchlist ?? []),
            ];
          })
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
  }, [years, limit]);

  return (
    <>
      <div className="rh-section-header">
        <div className="rh-section-title">Younger Prospects</div>
        <div className="rh-section-subtitle">
          {yearLabel} early watchboard — not the locked 2028 UF target board.
        </div>
      </div>
      {loading ? (
        <div className="rh-hub-warming" role="status" aria-live="polite" aria-busy="true">
          <UiWarming hint={`Loading ${yearLabel} younger prospects…`} />
        </div>
      ) : !players.length ? (
        <section className="rh-card" data-testid="rh-younger-prospects">
          <p className="rh-empty">
            {error
              ? 'Could not load younger prospects.'
              : `No ${yearLabel} prospects on the watchboard yet.`}
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
            <a href={EARLY_DISCOVERY_HREF} className="rh-cc-link">
              Open Early Discovery
              {total > players.length ? ` (${total} tracked)` : ''} →
            </a>
          </p>
        </section>
      )}
    </>
  );
}
