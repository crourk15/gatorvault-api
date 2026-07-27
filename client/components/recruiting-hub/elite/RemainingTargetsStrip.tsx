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

function shortCommitLabel(school: string): string {
  const n = String(school || '').trim();
  if (/georgia tech/i.test(n)) return 'GT';
  if (/georgia/i.test(n)) return 'Georgia';
  if (/texas tech/i.test(n)) return 'Texas Tech';
  if (/texas(?! a&m)/i.test(n)) return 'Texas';
  if (/oklahoma/i.test(n)) return 'Oklahoma';
  if (/alabama/i.test(n)) return 'Bama';
  return n.split(/\s+/)[0] || n;
}

function remainingStatus(target: RhHubHeatTarget): {
  label: string;
  tone: 'lean' | 'open' | 'contested' | 'flip';
} {
  if (target.flipWatch || (target.committedTo && !/florida|gators/i.test(String(target.committedTo)))) {
    return { label: 'Flip watch', tone: 'flip' };
  }
  const ufPercent = target.ufPercent;
  if (ufPercent == null || !Number.isFinite(ufPercent)) {
    return { label: 'Open', tone: 'open' };
  }
  if (ufPercent >= 60) return { label: 'Lean UF', tone: 'lean' };
  if (ufPercent >= 40) return { label: 'In play', tone: 'open' };
  return { label: 'Contested', tone: 'contested' };
}

function CommitMark({ school }: { school: string }): React.ReactElement {
  const src = schoolLogoUrl(school);
  const label = shortCommitLabel(school);
  const initials = schoolLogoInitials(school) || label.slice(0, 2).toUpperCase();
  return (
    <span className="rh-remaining-row__school" title={`Committed to ${school}`}>
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
      <span className="rh-remaining-row__school-name">{label}</span>
    </span>
  );
}

function RemainingRow({ target }: { target: RhHubHeatTarget }): React.ReactElement {
  const status = remainingStatus(target);
  const profileHref = playerProfileRoute(String(target.id || ''), 'futurecast');
  const commitSchool =
    target.committedTo && !/florida|gators/i.test(String(target.committedTo))
      ? String(target.committedTo)
      : null;

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
      {commitSchool ? (
        <CommitMark school={commitSchool} />
      ) : (
        <span className="rh-remaining-row__school rh-remaining-row__school--open">Uncommitted</span>
      )}
    </li>
  );
}

/**
 * Closing-class strip: unsigned + flip-watch names still in play.
 * School mark = hard commit only — never top RPM rival.
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
      .sort((a, b) => {
        const aFlip = a.flipWatch || Boolean(a.committedTo) ? 1 : 0;
        const bFlip = b.flipWatch || Boolean(b.committedTo) ? 1 : 0;
        // Uncommitted chase names first, then flip watch.
        if (aFlip !== bFlip) return aFlip - bFlip;
        return Number(b.ufPercent ?? -1) - Number(a.ufPercent ?? -1);
      })
      .slice(0, MAX_REMAINING);
  }, [data]);

  return (
    <>
      <div className="rh-section-header">
        <div className="rh-section-title">Remaining Targets</div>
        <div className="rh-section-subtitle">
          {activeYear} — uncommitted names still open, plus flip-watch commits.
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
