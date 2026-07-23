'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { TeamElitePageShell } from '@/components/team/premium/TeamElitePageShell';
import {
  PROGRAM_ACHIEVEMENTS,
  PROGRAM_ERAS,
  type ProgramEraDetail,
} from '@/lib/team-program-content';

function EraPanel({ era }: { era: ProgramEraDetail }): React.ReactElement {
  return (
    <article className="team-history-era" id={era.id}>
      <div className="team-history-era__meta">
        <span className="team-history-era__years">{era.label}</span>
        <span className="team-history-era__title">{era.title}</span>
      </div>
      <p className="team-history-era__summary">{era.summary}</p>

      <div className="team-history-era__cols">
        <div>
          <h4 className="team-history-era__h">Coaching</h4>
          <ul>
            {era.coaching.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="team-history-era__h">Milestones</h4>
          <ul>
            {era.milestones.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="team-history-era__cols">
        <div>
          <h4 className="team-history-era__h">Scheme</h4>
          <ul>
            {era.schemes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="team-history-era__h">Culture</h4>
          <ul>
            {era.culture.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      {era.winners.length > 0 ? (
        <p className="team-history-era__winners">
          <strong>Standouts:</strong> {era.winners.join(' · ')}
        </p>
      ) : null}
    </article>
  );
}

export function TeamHistoryDestinationPage(): React.ReactElement {
  const [openEraId, setOpenEraId] = useState<string | null>(PROGRAM_ERAS[0]?.id ?? null);

  return (
    <TeamElitePageShell testId="vault-team-history">
      <section className="team-dest-hero team-premium-bleed" aria-labelledby="team-history-hero-title">
        <div className="rh-frame team-dest-hero__inner">
          <p className="team-dest-hero__kicker">GatorVault · Team</p>
          <h1 id="team-history-hero-title" className="team-dest-hero__title">
            Program History
          </h1>
          <p className="team-dest-hero__sub">
            Dynasty eras, championships, Heisman winners, and the numbers that built the brand.
          </p>
          <p className="team-dest-hero__meta">
            {PROGRAM_ERAS.length} eras · {PROGRAM_ACHIEVEMENTS.length} hardware lanes
          </p>
        </div>
      </section>

      <div className="rh-frame rh-cc-page team-premium-cc-page team-dest-page">
        <Link href="/vault/team/" className="team-dest-back">
          ← Back to Team hub
        </Link>

        <header className="team-dest-page__intro">
          <p className="team-dest-page__kicker">Legacy</p>
          <h2 className="team-dest-page__h">Built in The Swamp</h2>
          <p className="team-dest-page__lede">
            From the foundation decades through Spurrier and Meyer into the modern reset — open an
            era for coaching, milestones, scheme, and culture.
          </p>
        </header>

        <section className="team-history-achievements" aria-labelledby="history-achievements">
          <h3 id="history-achievements" className="team-dest-block__title">
            Hardware & milestones
          </h3>
          <div className="team-history-achievements__grid">
            {PROGRAM_ACHIEVEMENTS.map((a) => (
              <article key={a.id} className="team-history-achievement">
                <span className="team-history-achievement__stat">{a.stat}</span>
                <h4 className="team-history-achievement__title">{a.label}</h4>
                <p className="team-history-achievement__detail">{a.note}</p>
                {a.highlights.length > 0 ? (
                  <ul className="team-history-achievement__list">
                    {a.highlights.slice(0, 4).map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="team-history-eras" aria-labelledby="history-eras">
          <h3 id="history-eras" className="team-dest-block__title">
            Dynasty eras
          </h3>
          <div className="team-history-eras__tabs" role="tablist" aria-label="Program eras">
            {PROGRAM_ERAS.map((era) => {
              const selected = openEraId === era.id;
              return (
                <button
                  key={era.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={`team-history-eras__tab${selected ? ' is-active' : ''}`}
                  onClick={() => setOpenEraId(era.id)}
                >
                  <span className="team-history-eras__tab-years">{era.label}</span>
                  <span className="team-history-eras__tab-title">{era.title}</span>
                </button>
              );
            })}
          </div>
          {PROGRAM_ERAS.filter((era) => era.id === openEraId).map((era) => (
            <EraPanel key={era.id} era={era} />
          ))}
        </section>
      </div>
    </TeamElitePageShell>
  );
}
