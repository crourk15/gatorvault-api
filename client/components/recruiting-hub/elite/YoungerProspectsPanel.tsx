'use client';

import React, { useEffect, useState } from 'react';
import { ClassicRecruitCard } from '@/components/vault/ClassicRecruitCard';
import { fromYoungerProspect } from '@/lib/recruiting-card-adapters';
import { fetchFutureCastUnderclassmen } from '@/lib/futurecast-underclassmen-api';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import { UiWarming } from '@/components/site/UiMessage';
import {
  groupYoungerProspectsByYear,
  isAthHeavyShownPlayers,
  YOUNGER_PROSPECT_HUB_CAPS,
  YOUNGER_PROSPECT_YEARS,
  type YoungerProspectYearGroup,
} from '@/lib/younger-prospects';

export { YOUNGER_PROSPECT_YEARS };

type Props = {
  years?: readonly number[];
};

export function YoungerProspectsPanel({
  years = YOUNGER_PROSPECT_YEARS,
}: Props): React.ReactElement {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<YoungerProspectYearGroup<RecruitingBoardPlayer>[]>([]);
  const yearLabel = years.length === 1 ? String(years[0]) : `${years[0]}–${years[years.length - 1]}`;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchFutureCastUnderclassmen([...years]);
        if (cancelled) return;
        const merged = years.flatMap((year) => {
          const bucket = data.classes[String(year)];
          return [
            ...(bucket?.targets ?? []),
            ...(bucket?.earlyMovement ?? []),
            ...(bucket?.watchlist ?? []),
          ];
        });
        const seen = new Set<string>();
        const unique = merged.filter((p) => {
          if (seen.has(p.slug)) return false;
          seen.add(p.slug);
          return true;
        });
        const cards = unique.map(fromYoungerProspect);
        setGroups(groupYoungerProspectsByYear(cards, years, YOUNGER_PROSPECT_HUB_CAPS));
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load younger prospects');
        setGroups([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [years]);

  return (
    <>
      <div className="rh-section-header">
        <div className="rh-section-title">Younger Prospects</div>
        <div className="rh-section-subtitle">
          Early watchboard for {yearLabel} — not the locked 2028 UF target board.
        </div>
      </div>
      {loading ? (
        <div className="rh-hub-warming" role="status" aria-live="polite" aria-busy="true">
          <UiWarming hint={`Loading ${yearLabel} younger prospects…`} />
        </div>
      ) : !groups.length ? (
        <section className="rh-card" data-testid="rh-younger-prospects">
          <p className="rh-empty">
            {error
              ? 'Could not load younger prospects.'
              : `No ${yearLabel} prospects on the watchboard yet.`}
          </p>
        </section>
      ) : (
        <section data-testid="rh-younger-prospects" className="rh-younger-prospects">
          {groups.map((group) => (
            <div key={group.year} className="rh-younger-prospects__year" data-year={group.year}>
              <div className="rh-younger-prospects__year-head">
                <h3 className="rh-younger-prospects__year-title">{group.label}</h3>
                <span className="rh-younger-prospects__year-badge">{group.badge}</span>
                {group.total > group.players.length ? (
                  <span className="rh-younger-prospects__year-count">
                    Showing {group.players.length} of {group.total}
                  </span>
                ) : (
                  <span className="rh-younger-prospects__year-count">{group.total} tracked</span>
                )}
              </div>
              {isAthHeavyShownPlayers(group.players) ? (
                <p className="rh-younger-prospects__ath-note fc-profile-muted">
                  Positions still filling in for this class.
                </p>
              ) : null}
              <div className="rh-younger-prospects-grid gv-rb-grid">
                {group.players.map((player) => (
                  <ClassicRecruitCard key={player.slug} player={player} variant="target" />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </>
  );
}