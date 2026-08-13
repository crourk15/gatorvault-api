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
 * Closing Class Flip Watch — standalone section with a loud section title.
 */
export function FutureCastFlipWatchPanel({ flipWatch = [], bare }: Props): React.ReactElement | null {
  const { discoveryView } = useFutureCastLabCycle();
  const rows = useMemo(() => resolveClosingClassFlipWatch(flipWatch), [flipWatch]);

  if (discoveryView) return null;
  if (!rows.length) return null;

  return (
    <div className="fc-lab-flip-watch-section" data-testid="fc-lab-flip-watch-section">
      <FutureCastPanelShell
        bare={bare}
        title="Top 5 Flip Candidates"
        sub="Committed elsewhere — Florida's best remaining flip shots before signing day."
        testId="fc-lab-flip-watch-panel"
      >
        <div className="fc-lab-flip-grid">
          {rows.map((row, i) => (
            <FlipCard key={row.slug} row={row} rank={row.flipRank ?? i + 1} />
          ))}
        </div>
      </FutureCastPanelShell>
    </div>
  );
}
