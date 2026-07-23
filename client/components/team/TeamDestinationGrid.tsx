'use client';

import React from 'react';
import Link from 'next/link';

const DESTINATIONS = [
  {
    href: '/vault/team/staff/',
    room: '01',
    watermark: 'STAFF',
    kicker: 'Coaching room',
    title: 'Staff',
    copy: "Sumrall's coordinators and position coaches — the full Florida card.",
    cta: 'Enter staff',
  },
  {
    href: '/vault/team/identity/',
    room: '02',
    watermark: 'SWAMP',
    kicker: 'Swamp DNA',
    title: 'Identity',
    copy: 'Culture pillars, traditions, and the 2026 Florida standard.',
    cta: 'Enter identity',
  },
  {
    href: '/vault/team/history/',
    room: '03',
    watermark: 'LEGACY',
    kicker: 'Program ledger',
    title: 'History',
    copy: 'Titles, Heismans, and the eras that built Gator Nation.',
    cta: 'Enter history',
  },
] as const;

export function TeamDestinationGrid(): React.ReactElement {
  return (
    <section className="team-dest-grid" aria-label="Team destinations">
      <div className="team-dest-grid__head">
        <p className="team-dest-grid__kicker">Gator rooms</p>
        <h2 className="team-dest-grid__title">Staff · Identity · History</h2>
        <p className="team-dest-grid__sub">
          Leave Depth, Roster, and Pipeline on the hub — open the deeper Florida rooms from here.
        </p>
      </div>
      <div className="team-dest-grid__cards">
        {DESTINATIONS.map((d) => (
          <Link key={d.href} href={d.href} className="team-dest-card">
            <span className="team-dest-card__watermark" aria-hidden="true">
              {d.watermark}
            </span>
            <span className="team-dest-card__room">{d.room}</span>
            <p className="team-dest-card__kicker">{d.kicker}</p>
            <h3 className="team-dest-card__title">{d.title}</h3>
            <p className="team-dest-card__copy">{d.copy}</p>
            <span className="team-dest-card__cta">{d.cta}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
