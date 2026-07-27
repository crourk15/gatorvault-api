'use client';

import React, { useCallback, useMemo } from 'react';
import type { RhHubHeatTarget } from '@/lib/recruiting-hub-elite-api';
import { fetchRecruitingHubHeatIndex } from '@/lib/recruiting-hub-elite-api';
import { useRecruitingClassYear } from '@/lib/recruiting-class-year-store';
import { useHubBundleSection } from '@/components/recruiting-hub/elite/useHubBundleSection';
import { playerProfileRoute } from '@/lib/vault-route-map';
import { schoolLogoInitials, schoolLogoUrl } from '@/lib/school-logos';
import { UiWarming } from '@/components/site/UiMessage';

const MAX_REMAINING = 6;

/** Thin status — Flip Watch / deep odds stay on FutureCast. */
function remainingStatus(ufPercent: number | null): { label: string; tone: 'lean' | 'open' | 'contested' } {
  if (ufPercent == null || !Number.isFinite(ufPercent)) {
    return { label: 'Flip watch', tone: 'open' };
  }
  if (ufPercent >= 60) return { label: 'Lean UF', tone: 'lean' };
  if (ufPercent >= 40) return { label: 'In play', tone: 'open' };
  return { label: 'Contested', tone: 'contested' };
}

function RivalMark({ school }: { school: string | null | undefined }): React.ReactElement | null {
  if (!school) return null;
  const src = schoolLogoUrl(school);
  const initials = schoolLogoInitials(school) || school.slice(0, 2).toUpperCase();
  return (
    <span className="rh-remaining-row__school" title={school}>
      {src ? (
        // ESPN NCAA marks
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="rh-remaining-row__school-logo"
          src={src}
          alt=""
          width={24}
          height={24}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="rh-remaining-row__school-fallback" aria-hidden>
          {initials}
        </span>
      )}
      <span className="rh-remaining-row__school-name">{school}</span>
    </span>
  );
}

function RemainingRow({ target }: { target: RhHubHeatTarget }): React.ReactElement {
  const status = remainingStatus(target.ufPercent);
  const profileHref = playerProfileRoute(String(target.id || ''), 'futurecast');
  const school = target.battle?.competitorName || null;

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
      <RivalMark school={school} />
    </li>
  );
}

/**
 * Closing-class strip: unsigned / flip-watch names still in play.
 * Intentionally thin — deep odds stay on FutureCast 2027 Closing.
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
          {activeYear} flip candidates still in play — committed school when known.
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
