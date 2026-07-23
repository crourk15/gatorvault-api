'use client';

import React from 'react';
import { PlayerNavLink } from '@/components/vault/PlayerNavLink';
import { playerProfileRoute } from '@/lib/site-routes';
import type { NilPortalImpactRow } from './useNilEliteData';

type Props = {
  gains: NilPortalImpactRow[];
  losses: NilPortalImpactRow[];
};

function ImpactRow({ row }: { row: NilPortalImpactRow }): React.ReactElement {
  const body = (
    <>
      <div className="nil-portal-col__head">
        <strong>{row.name}</strong>
        <span className="nil-portal-col__pos">{row.position}</span>
      </div>
      <div className="nil-portal-col__range">{row.range}</div>
      <p className="nil-portal-col__note">{row.note}</p>
      <span className={`nil-portal-col__trend nil-portal-col__trend--${row.trend}`} aria-hidden>
        {row.trend === 'up' ? '↑' : row.trend === 'down' ? '↓' : '→'}
      </span>
      {row.slug ? <span className="nil-portal-col__cta">Profile</span> : null}
    </>
  );

  if (row.slug) {
    return (
      <li className="nil-portal-col__item nil-portal-col__item--link">
        <PlayerNavLink
          href={playerProfileRoute(row.slug, 'futurecast')}
          className="nil-portal-col__link"
        >
          {body}
        </PlayerNavLink>
      </li>
    );
  }

  return <li className="nil-portal-col__item">{body}</li>;
}

function ImpactColumn({
  title,
  tone,
  rows,
}: {
  title: string;
  tone: 'gain' | 'loss';
  rows: NilPortalImpactRow[];
}): React.ReactElement {
  return (
    <div className={`nil-portal-col nil-portal-col--${tone}`}>
      <h3 className="nil-portal-col__title">{title}</h3>
      <ul className="nil-portal-col__list">
        {rows.length === 0 ? (
          <li className="nil-portal-col__empty">No tracked portal or commit movement in this window.</li>
        ) : (
          rows.map((row) => <ImpactRow key={row.id} row={row} />)
        )}
      </ul>
    </div>
  );
}

export function NilPortalImpact({ gains, losses }: Props): React.ReactElement {
  return (
    <section className="nil-elite-section" data-testid="nil-portal-impact">
      <header className="nil-elite-section__head">
        <div>
          <h2 className="nil-elite-section__title">Portal &amp; Commit NIL Impact</h2>
          <p className="nil-elite-section__sub">
            Portal intel plus UF commits / commits elsewhere. Dollar bands are modeled estimates —
            not reported deals. Tap a player name for their profile.
          </p>
        </div>
      </header>
      <div className="nil-portal-grid">
        <ImpactColumn title="UF side (gains / intel)" tone="gain" rows={gains} />
        <ImpactColumn title="Lost / elsewhere" tone="loss" rows={losses} />
      </div>
    </section>
  );
}
