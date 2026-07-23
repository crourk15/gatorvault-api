'use client';

import React from 'react';
import Link from 'next/link';
import { TeamElitePageShell } from '@/components/team/premium/TeamElitePageShell';
import { TEAM_IDENTITY_DETAIL } from '@/lib/team-program-content';

const CURRENT_SIGNALS = [
  {
    code: '3-3-5',
    title: 'Defensive identity',
    body: 'Brad White odd front — JACK and STAR hybrids, speed on the edge, Swamp pressure.',
  },
  {
    code: 'RPO',
    title: 'Conflict offense',
    body: 'Conflict-read rhythm with vertical shots — skill talent that wins one-on-ones.',
  },
  {
    code: 'PORTAL',
    title: 'Roster build',
    body: 'Portal-powered construction under Sumrall — contend now, develop next.',
  },
] as const;

const TRADITIONS = [
  {
    title: 'The Swamp',
    body: "Home-field intimidation since 1990 — opponents' dreams go to die here.",
  },
  {
    title: 'Orange & Blue',
    body: 'National SEC brand. Instant recognition. No muted neutrals.',
  },
  {
    title: 'Gator Chomp',
    body: 'The universal rally signal across Gator Nation — stands, bus, and living room.',
  },
  {
    title: 'Championship standard',
    body: 'Three national titles. Eight SEC crowns. The measuring stick every season.',
  },
] as const;

export function TeamIdentityDestinationPage(): React.ReactElement {
  const d = TEAM_IDENTITY_DETAIL;

  return (
    <TeamElitePageShell testId="vault-team-identity">
      <section className="team-dest-hero team-dest-hero--identity team-premium-bleed" aria-labelledby="team-identity-hero-title">
        <div className="rh-frame team-dest-hero__inner">
          <p className="team-dest-hero__kicker">GatorVault · Team</p>
          <h1 id="team-identity-hero-title" className="team-dest-hero__title">
            Team Identity
          </h1>
          <p className="team-dest-hero__sub">{d.summary}</p>
        </div>
      </section>

      <div className="rh-frame rh-cc-page team-premium-cc-page team-dest-page">
        <Link href="/vault/team/" className="team-dest-back">
          ← Back to Team hub
        </Link>

        <section className="team-id-lede" aria-label="Identity opener">
          <p className="team-id-lede__text">
            Toughness. Defense. Hostile home field. Florida football is Swamp DNA first — then scheme,
            then the portal-era roster that has to live up to it.
          </p>
        </section>

        <section className="team-id-signals" aria-labelledby="identity-now">
          <div className="team-history-section-head">
            <p className="team-dest-page__kicker">2026 standard</p>
            <h2 id="identity-now" className="team-dest-page__h">
              How Florida plays now
            </h2>
          </div>
          <div className="team-id-signals__grid">
            {CURRENT_SIGNALS.map((s) => (
              <article key={s.code} className="team-id-signal">
                <span className="team-id-signal__code">{s.code}</span>
                <h3 className="team-id-signal__title">{s.title}</h3>
                <p className="team-id-signal__body">{s.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="team-id-pillars" aria-labelledby="identity-pillars">
          <div className="team-history-section-head">
            <p className="team-dest-page__kicker">Culture pillars</p>
            <h2 id="identity-pillars" className="team-dest-page__h">
              Non-negotiables
            </h2>
          </div>
          <ol className="team-id-pillars__grid">
            {d.pillars.map((pillar, i) => (
              <li key={pillar} className="team-id-pillar">
                <span className="team-id-pillar__num">{String(i + 1).padStart(2, '0')}</span>
                <p className="team-id-pillar__text">{pillar}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="team-id-traditions" aria-labelledby="identity-traditions">
          <div className="team-history-section-head">
            <p className="team-dest-page__kicker">Traditions</p>
            <h2 id="identity-traditions" className="team-dest-page__h">
              Signals of the Swamp
            </h2>
          </div>
          <div className="team-id-traditions__grid">
            {TRADITIONS.map((t) => (
              <article key={t.title} className="team-id-tradition">
                <h3 className="team-id-tradition__title">{t.title}</h3>
                <p className="team-id-tradition__body">{t.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="team-id-highlights" aria-labelledby="identity-highlights">
          <div className="team-history-section-head">
            <p className="team-dest-page__kicker">Through-line</p>
            <h2 id="identity-highlights" className="team-dest-page__h">
              What never changes
            </h2>
          </div>
          <ul className="team-id-highlights__list">
            {d.highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </section>
      </div>
    </TeamElitePageShell>
  );
}
