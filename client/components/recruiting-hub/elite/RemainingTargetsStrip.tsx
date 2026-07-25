'use client';

import React, { useCallback, useMemo } from 'react';
import type { RhHubHeatTarget } from '@/lib/recruiting-hub-elite-api';
import { fetchRecruitingHubHeatIndex } from '@/lib/recruiting-hub-elite-api';
import { useRecruitingClassYear } from '@/lib/recruiting-class-year-store';
import { useHubBundleSection } from '@/components/recruiting-hub/elite/useHubBundleSection';
import { playerProfileRoute, VAULT_PILLAR_ROUTES } from '@/lib/vault-route-map';
import { UiWarming } from '@/components/site/UiMessage';

const MAX_REMAINING = 6;

/** Thin status only — no heat bars / battle scores (those live on FutureCast). */
function remainingStatus(ufPercent: number | null): { label: string; tone: 'lean' | 'open' | 'contested' } {
  if (ufPercent == null || !Number.isFinite(ufPercent)) {
    return { label: 'Open', tone: 'open' };
  }
  if (ufPercent >= 60) return { label: 'Lean UF', tone: 'lean' };
  if (ufPercent >= 40) return { label: 'In play', tone: 'open' };
  return { label: 'Contested', tone: 'contested' };
}

function RemainingRow({ target }: { target: RhHubHeatTarget }): React.ReactElement {
  const status = remainingStatus(target.ufPercent);
  // Name → that player's FutureCast intel page.
  const profileHref = playerProfileRoute(String(target.id || ''), 'futurecast');
  // "FutureCast →" → the Lab closing board (not another profile link).
  const labHref = VAULT_PILLAR_ROUTES.futurecast;

  return (
    <li className="rh-remaining-row" data-testid={`rh-remaining-${target.id}`}>
      <div className="rh-remaining-row__identity">
        <a href={profileHref} className="rh-remaining-row__name">
          {target.name}
        </a>
        <span className="rh-remaining-row__pos">{target.position}</span>
      </div>
      <span className={`rh-remaining-row__status rh-remaining-row__status--${status.tone}`}>
        {status.label}
      </span>
      <a href={labHref} className="rh-remaining-row__link">
        FutureCast →
      </a>
    </li>
  );
}

/**
 * Closing-class strip: unsigned targets still in play (e.g. Tranard Roberts).
 * Intentionally thin — Flip Watch / odds / heat stay on FutureCast 2027 Closing.
 */
export function RemainingTargetsStrip(): React.ReactElement | null {
  const { activeYear } = useRecruitingClassYear();
  const selectHeat = useCallback((b: { heatIndex: RhHubHeatTarget[] }) => b.heatIndex, []);
  const fetchHeat = useCallback((year: number) => fetchRecruitingHubHeatIndex(year), []);
  const { data, loading, error } = useHubBundleSection({
    select: selectHeat,
    fetchFallback: fetchHeat,
  });

  const rows = useMemo(() => {
    const list = Array.isArray(data) ? data : [];
    return [...list]
      .sort((a, b) => Number(b.ufPercent ?? -1) - Number(a.ufPercent ?? -1))
      .slice(0, MAX_REMAINING);
  }, [data]);

  return (
    <>
      <div className="rh-section-header">
        <div className="rh-section-title">Remaining Targets</div>
        <div className="rh-section-subtitle">
          {activeYear} class — unsigned names still in play. Deep odds and flip watch live on FutureCast.
        </div>
      </div>
      {loading ? (
        <div className="rh-hub-warming" role="status" aria-live="polite" aria-busy="true">
          <UiWarming hint="Loading remaining targets…" />
        </div>
      ) : !rows.length ? (
        <section className="rh-card" data-testid="rh-remaining-targets">
          <p className="rh-empty">
            {error
              ? 'Could not load remaining targets.'
              : 'No unsigned targets left on the closing board.'}
          </p>
        </section>
      ) : (
        <section className="rh-card rh-remaining-targets" data-testid="rh-remaining-targets">
          <ul className="rh-remaining-list">
            {rows.map((target) => (
              <RemainingRow key={target.id} target={target} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
