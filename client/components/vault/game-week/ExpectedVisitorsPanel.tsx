'use client';

import React from 'react';
import type { ScheduleGame } from '@/lib/schedule-data';
import { playerProfilePath } from '@/lib/player-routes';
import { VaultNavLink } from '@/components/vault/VaultNavLink';

type Visitor = NonNullable<ScheduleGame['expectedVisitors']>['visitors'][number];

type Props = {
  panel: NonNullable<ScheduleGame['expectedVisitors']>;
};

function metaLine(v: Visitor): string {
  const bits: string[] = [];
  if (v.position) bits.push(String(v.position));
  if (v.stars != null && Number(v.stars) > 0) bits.push(`${Math.round(Number(v.stars))}★`);
  if (v.classYear) bits.push(String(v.classYear));
  if (v.school) bits.push(String(v.school));
  return bits.join(' · ');
}

/**
 * Dedicated Game Week Expected visitors surface — not buried in 3 Keys.
 */
export function ExpectedVisitorsPanel({ panel }: Props): React.ReactElement {
  const visitors = Array.isArray(panel.visitors) ? panel.visitors : [];
  const opp = panel.opponent || 'this week';
  const when = panel.dateLabel ? ` · ${panel.dateLabel}` : '';

  return (
    <div className="gv-gw-visitors" data-testid="gw-expected-visitors">
      <p className="gv-gw-visitors__dek">
        Early look for {opp}
        {when}. Plans can change.
      </p>
      <ul className="gv-gw-visitors__list">
        {visitors.map((v) => {
          const href = playerProfilePath(v.slug, 'HIGH_SCHOOL', true, v.name, 'recruiting');
          const meta = metaLine(v);
          return (
            <li key={v.slug} className="gv-gw-visitors__item">
              <VaultNavLink href={href} className="gv-gw-visitors__link">
                <span className="gv-gw-visitors__mark" aria-hidden>
                  {(v.position || 'HS').slice(0, 3).toUpperCase()}
                </span>
                <span className="gv-gw-visitors__copy">
                  <span className="gv-gw-visitors__name">{v.name}</span>
                  {meta ? <span className="gv-gw-visitors__meta">{meta}</span> : null}
                </span>
                <span className="gv-gw-visitors__chevron" aria-hidden>
                  →
                </span>
              </VaultNavLink>
            </li>
          );
        })}
      </ul>
      {panel.source ? <p className="gv-gw-visitors__source">{panel.source}</p> : null}
    </div>
  );
}
