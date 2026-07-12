/**
 * Ranked school row — logo + name + % (no confusing meters).
 */
import React, { useState } from 'react';
import { schoolLogoInitials, schoolLogoUrl } from '@/lib/school-logos';

export interface SchoolRankRowProps {
  rank: number;
  school: string;
  pct: number;
  /** Soft highlight for the board leader / Florida. */
  emphasize?: boolean;
  /** Optional muted line under the school name (e.g. source). */
  detail?: string | null;
}

function formatPct(pct: number): string {
  if (!Number.isFinite(pct)) return '—';
  const rounded = Math.round(pct * 10) / 10;
  return `${rounded}%`;
}

export function SchoolRankRow({
  rank,
  school,
  pct,
  emphasize = false,
  detail,
}: SchoolRankRowProps): React.ReactElement {
  const logo = schoolLogoUrl(school);
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = Boolean(logo) && !imgFailed;

  return (
    <li
      className={`fc-school-rank${emphasize ? ' fc-school-rank--lead' : ''}`}
      data-testid="school-rank-row"
    >
      <span className="fc-school-rank__rank" aria-hidden="true">
        {rank}
      </span>
      <span className="fc-school-rank__logo" aria-hidden="true">
        {showImg ? (
          <img
            src={logo!}
            alt=""
            width={28}
            height={28}
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span className="fc-school-rank__initials">{schoolLogoInitials(school)}</span>
        )}
      </span>
      <div className="fc-school-rank__identity">
        <span className="fc-school-rank__school">{school}</span>
        {detail ? <span className="fc-school-rank__detail">{detail}</span> : null}
      </div>
      <span className="fc-school-rank__pct">{formatPct(pct)}</span>
    </li>
  );
}
