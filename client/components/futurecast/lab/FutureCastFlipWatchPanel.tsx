'use client';

import React, { useMemo } from 'react';
import type { FlipWatchRow } from '@/lib/futurecast-high-priority-api';
import { playerProfileRoute } from '@/lib/vault-route-map';
import { schoolLogoInitials, schoolLogoUrl } from '@/lib/school-logos';
import { resolveClosingClassFlipWatch } from '@/lib/closing-class-flip-watch';
import { FutureCastPanelShell } from './primitives';
import { useFutureCastLabCycle } from './FutureCastLabCycleContext';

type Props = {
  flipWatch?: FlipWatchRow[];
  bare?: boolean;
};

function CommitSchoolMark({ school }: { school: string }): React.ReactElement {
  const src = schoolLogoUrl(school);
  const initials = schoolLogoInitials(school);
  if (src) {
    return (
      // ESPN CDN NCAA marks — same source as recruiting battle boards.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="fc-lab-flip-card__logo"
        src={src}
        alt=""
        width={36}
        height={36}
        loading="lazy"
        decoding="async"
      />
    );
  }
  return <span className="fc-lab-flip-card__logo-fallback">{initials}</span>;
}

function FlipCard({ row, rank }: { row: FlipWatchRow; rank: number }): React.ReactElement {
  const href = playerProfileRoute(row.slug, 'futurecast');
  const school = row.committedTo || row.committedShort;
  const metaBits = [
    row.position ? String(row.position) : null,
    row.stars && row.stars > 0 ? `${row.stars}\u2605` : null,
  ].filter(Boolean);

  return (
    <a href={href} className="fc-lab-flip-card" data-testid={`fc-lab-flip-${row.slug}`}>
      <span className="fc-lab-flip-card__rank" aria-label={`Flip rank ${rank}`}>
        #{rank}
      </span>
      <div className="fc-lab-flip-card__body">
        <strong className="fc-lab-flip-card__name">{row.name}</strong>
        {metaBits.length ? <span className="fc-lab-flip-card__meta">{metaBits.join(' \u00b7 ')}</span> : null}
        <span className="fc-lab-flip-card__commit">
          <CommitSchoolMark school={school} />
          <span>
            Committed to <em>{row.committedTo || row.committedShort || school}</em>
          </span>
        </span>
      </div>
    </a>
  );
}

/**
 * 2027 Closing Class Flip Watch + 2028+ Committed elsewhere lane (same HP flipWatch payload).
 */
export function FutureCastFlipWatchPanel({ flipWatch = [], bare }: Props): React.ReactElement | null {
  const { discoveryView } = useFutureCastLabCycle();
  const rows = useMemo(() => {
    if (discoveryView) {
      // Open-cycle: use live API only — never fall back to 2027 Closing Class seed.
      if (!Array.isArray(flipWatch) || flipWatch.length === 0) return [];
      return flipWatch.map((row, i) => ({
        ...row,
        flipRank: row.flipRank ?? i + 1,
        committedShort: row.committedShort || row.committedTo?.split(/\s+/)[0] || 'Other',
      }));
    }
    return resolveClosingClassFlipWatch(flipWatch);
  }, [discoveryView, flipWatch]);

  if (!rows.length) return null;

  const title = discoveryView ? 'Committed elsewhere' : 'Top 5 Flip Candidates';
  const sub = discoveryView
    ? 'Vault prospects already committed — kept beside Priority Chase, never as open targets.'
    : "Committed elsewhere — Florida's best remaining flip shots before signing day.";

  return (
    <div className="fc-lab-flip-watch-section" data-testid="fc-lab-flip-watch-section">
      <FutureCastPanelShell bare={bare} title={title} sub={sub} testId="fc-lab-flip-watch-panel">
        <div className="fc-lab-flip-grid">
          {rows.map((row, i) => (
            <FlipCard key={row.slug} row={row} rank={row.flipRank ?? i + 1} />
          ))}
        </div>
      </FutureCastPanelShell>
    </div>
  );
}
