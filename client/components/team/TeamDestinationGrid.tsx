'use client';

import React from 'react';
import Link from 'next/link';

const DESTINATIONS = [
  {
    href: '/vault/team/staff/',
    mark: 'S',
    title: 'Coaching Staff',
    copy: "Sumrall's room — coordinators, position coaches, and the full Florida staff card.",
    cta: 'Open staff',
  },
  {
    href: '/vault/team/identity/',
    mark: 'I',
    title: 'Team Identity',
    copy: 'Swamp DNA — culture pillars, traditions, and what Florida football means.',
    cta: 'Open identity',
  },
  {
    href: '/vault/team/history/',
    mark: 'H',
    title: 'Program History',
    copy: 'Dynasty eras, championships, Heisman winners, and the program ledger.',
    cta: 'Open history',
  },
] as const;

export function TeamDestinationGrid(): React.ReactElement {
  return (
    <section className="team-dest-grid" aria-label="Team destinations">
      <div className="team-dest-grid__head">
        <p className="team-dest-grid__kicker">Explore</p>
        <h2 className="team-dest-grid__title">Staff · Identity · History</h2>
        <p className="team-dest-grid__sub">
          Deeper rooms off the hub — Depth, Roster, and Pipeline stay here for game-week work.
        </p>
      </div>
      <div className="team-dest-grid__cards">
        {DESTINATIONS.map((d) => (
          <Link key={d.href} href={d.href} className="team-dest-card">
            <span className="team-dest-card__icon" aria-hidden>
              {d.mark}
            </span>
            <div className="team-dest-card__body">
              <h3 className="team-dest-card__title">{d.title}</h3>
              <p className="team-dest-card__copy">{d.copy}</p>
              <span className="team-dest-card__cta">{d.cta} →</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
