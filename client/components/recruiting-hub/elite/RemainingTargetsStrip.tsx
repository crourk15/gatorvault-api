'use client';

import React, { useCallback, useMemo } from 'react';
import type { RhHubHeatTarget } from '@/lib/recruiting-hub-elite-api';
import { fetchRecruitingHubHeatIndex } from '@/lib/recruiting-hub-elite-api';
import { useRecruitingClassYear } from '@/lib/recruiting-class-year-store';
import { useHubBundleSection } from '@/components/recruiting-hub/elite/useHubBundleSection';
import { playerProfileRoute } from '@/lib/vault-route-map';
import { schoolLogoInitials, schoolLogoUrl } from '@/lib/school-logos';
import { CLOSING_CLASS_FLIP_WATCH } from '@/lib/closing-class-flip-watch';
import { UiWarming } from '@/components/site/UiMessage';

const MAX_REMAINING = 6;

const FLIP_COMMIT_BY_SLUG = new Map(
  CLOSING_CLASS_FLIP_WATCH.map((row) => [String(row.slug).toLowerCase(), row.committedTo])
);

function isFloridaSchool(school: string | null | undefined): boolean {
  return Boolean(school && /\bflorida\b|\bgators\b/i.test(String(school)));
}

function shortCommitLabel(school: string): string {
  const n = String(school || '').trim();
  if (/georgia tech/i.test(n)) return 'GT';
  if (/notre dame/i.test(n)) return 'Notre Dame';
  if (/texas tech/i.test(n)) return 'Texas Tech';
  if (/texas(?! a&m)/i.test(n)) return 'Texas';
  if (/oklahoma/i.test(n)) return 'Oklahoma';
  if (/alabama/i.test(n)) return 'Bama';
  if (/miami/i.test(n)) return 'Miami';
  if (/georgia/i.test(n)) return 'Georgia';
  return n.split(/\s+/)[0] || n;
}

type RemainingTarget = RhHubHeatTarget & {
  committedTo?: string | null;
  flipWatch?: boolean;
};

/** Merge live heat rows with curated flip-watch commits (API often omits committedTo). */
function enrichRemainingTarget(raw: RhHubHeatTarget): RemainingTarget {
  const slug = String(raw.id || '').toLowerCase();
  const curatedCommit = FLIP_COMMIT_BY_SLUG.get(slug) || null;
  const apiCommit =
    raw.committedTo && !isFloridaSchool(raw.committedTo) ? String(raw.committedTo) : null;
  const committedTo = apiCommit || curatedCommit;
  const flipWatch = Boolean(raw.flipWatch || committedTo);
  return {
    ...raw,
    committedTo: flipWatch ? committedTo : null,
    flipWatch,
  };
}

function remainingStatus(target: RemainingTarget): {
  label: string;
  tone: 'lean' | 'open' | 'contested' | 'flip';
} {
  if (target.flipWatch || (target.committedTo && !isFloridaSchool(target.committedTo))) {
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

function RemainingRow({ target }: { target: RemainingTarget }): React.ReactElement {
  const status = remainingStatus(target);
  const profileHref = playerProfileRoute(String(target.id || ''), 'futurecast');
  const commitSchool =
    target.committedTo && !isFloridaSchool(target.committedTo)
      ? String(target.committedTo)
      : null;

  return (
    <li
      className={`rh-remaining-row${commitSchool ? ' rh-remaining-row--flip' : ''}`}
      data-testid={`rh-remaining-${target.id}`}
    >
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
    const list = Array.isArray(data) ? data.map(enrichRemainingTarget) : [];
    const bySlug = new Map(list.map((row) => [String(row.id || '').toLowerCase(), row]));

    // Ensure curated flip-watch commits appear even if heat-index drops them.
    if (activeYear === 2027) {
      for (const flip of CLOSING_CLASS_FLIP_WATCH) {
        const slug = String(flip.slug).toLowerCase();
        if (bySlug.has(slug)) continue;
        bySlug.set(slug, {
          id: flip.slug,
          name: flip.name,
          position: flip.position || '—',
          heat: 0,
          movement: 'flat',
          ufPercent: flip.ufProbability ?? null,
          battle: { uf: null, competitor: null, competitorName: null },
          committedTo: flip.committedTo || null,
          flipWatch: true,
          nextVisit: null,
          profileUrl: `/vault/recruiting/player/${flip.slug}`,
        });
      }
    }

    return [...bySlug.values()]
      .sort((a, b) => {
        const aFlip = a.flipWatch || Boolean(a.committedTo) ? 1 : 0;
        const bFlip = b.flipWatch || Boolean(b.committedTo) ? 1 : 0;
        // Uncommitted chase names first, then flip watch.
        if (aFlip !== bFlip) return aFlip - bFlip;
        return Number(b.ufPercent ?? -1) - Number(a.ufPercent ?? -1);
      })
      .slice(0, MAX_REMAINING);
  }, [data, activeYear]);

  return (
    <>
      <div className="rh-section-header">
        <div className="rh-section-title">Remaining Targets</div>
        <div className="rh-section-subtitle">
          {activeYear} — open board names, then flip-watch commits still in play.
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
