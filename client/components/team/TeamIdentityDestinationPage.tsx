'use client';

import React from 'react';
import Link from 'next/link';
import { TeamElitePageShell } from '@/components/team/premium/TeamElitePageShell';
import { TEAM_IDENTITY_DETAIL } from '@/lib/team-program-content';

export function TeamIdentityDestinationPage(): React.ReactElement {
  const d = TEAM_IDENTITY_DETAIL;
  const paragraphs = d.body
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <TeamElitePageShell testId="vault-team-identity">
      <section className="team-dest-hero team-premium-bleed" aria-labelledby="team-identity-hero-title">
        <div className="rh-frame team-dest-hero__inner">
          <p className="team-dest-hero__kicker">GatorVault · Team</p>
          <h1 id="team-identity-hero-title" className="team-dest-hero__title">
            {d.title}
          </h1>
          <p className="team-dest-hero__sub">{d.summary}</p>
          <p className="team-dest-hero__meta">{d.kicker}</p>
        </div>
      </section>

      <div className="rh-frame rh-cc-page team-premium-cc-page team-dest-page">
        <Link href="/vault/team/" className="team-dest-back">
          ← Back to Team hub
        </Link>

        <header className="team-dest-page__intro">
          <p className="team-dest-page__kicker">Swamp DNA</p>
          <h2 className="team-dest-page__h">What Florida football means</h2>
        </header>

        <section className="team-identity-deep__body" aria-label="Identity narrative">
          {paragraphs.map((p) => (
            <p key={p.slice(0, 48)} className="team-identity-deep__p">
              {p}
            </p>
          ))}
        </section>

        <section className="team-identity-deep" aria-labelledby="identity-pillars">
          <h3 id="identity-pillars" className="team-dest-block__title">
            Culture pillars
          </h3>
          <ul className="team-identity-deep__pillars">
            {d.pillars.map((pillar) => (
              <li key={pillar}>{pillar}</li>
            ))}
          </ul>
        </section>

        <section className="team-identity-deep__highlights" aria-labelledby="identity-highlights">
          <h3 id="identity-highlights" className="team-dest-block__title">
            Traditions & signals
          </h3>
          <ul className="team-identity-deep__list">
            {d.highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </section>
      </div>
    </TeamElitePageShell>
  );
}
