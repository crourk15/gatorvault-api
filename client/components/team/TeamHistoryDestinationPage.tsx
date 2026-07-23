'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { TeamElitePageShell } from '@/components/team/premium/TeamElitePageShell';
import {
  PROGRAM_ACHIEVEMENTS,
  PROGRAM_ERAS,
  type ProgramEraDetail,
} from '@/lib/team-program-content';

const HARDWARE = [
  { value: '3', label: 'National titles' },
  { value: '8', label: 'SEC crowns' },
  { value: '3', label: 'Heismans' },
  { value: '100+', label: 'All-Americans' },
] as const;

function EraRoom({ era }: { era: ProgramEraDetail }): React.ReactElement {
  return (
    <article className="team-era-room" id={era.id}>
      <header className="team-era-room__head">
        <p className="team-era-room__years">{era.label}</p>
        <h3 className="team-era-room__title">{era.title}</h3>
        <p className="team-era-room__summary">{era.summary}</p>
      </header>

      {era.players.length > 0 ? (
        <section className="team-era-room__block" aria-label="Standouts">
          <h4 className="team-era-room__label">Standouts</h4>
          <div className="team-era-room__players">
            {era.players.map((p) => (
              <div key={p.name} className="team-era-player">
                <span className="team-era-player__name">{p.name}</span>
                <span className="team-era-player__role">{p.role}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {era.games.length > 0 ? (
        <section className="team-era-room__block" aria-label="Signature games">
          <h4 className="team-era-room__label">Signature games</h4>
          <ul className="team-era-room__games">
            {era.games.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="team-era-room__split">
        <section className="team-era-room__panel" aria-label="Scheme">
          <h4 className="team-era-room__label">Scheme</h4>
          <ul>
            {era.schemes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section className="team-era-room__panel" aria-label="Culture">
          <h4 className="team-era-room__label">Culture</h4>
          <ul>
            {era.culture.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>

      <div className="team-era-room__split">
        <section className="team-era-room__panel" aria-label="Milestones">
          <h4 className="team-era-room__label">Milestones</h4>
          <ul>
            {era.milestones.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section className="team-era-room__panel" aria-label="Recruiting">
          <h4 className="team-era-room__label">Recruiting</h4>
          <ul>
            {era.recruiting.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>

      {era.achievements.length > 0 ? (
        <p className="team-era-room__achievements">
          <strong>Hardware:</strong> {era.achievements.join(' · ')}
        </p>
      ) : null}
    </article>
  );
}

export function TeamHistoryDestinationPage(): React.ReactElement {
  const [openEraId, setOpenEraId] = useState<string>(PROGRAM_ERAS[PROGRAM_ERAS.length - 1]?.id ?? '');

  return (
    <TeamElitePageShell testId="vault-team-history">
      <section className="team-dest-hero team-dest-hero--history team-premium-bleed" aria-labelledby="team-history-hero-title">
        <div className="rh-frame team-dest-hero__inner">
          <p className="team-dest-hero__kicker">GatorVault · Team</p>
          <h1 id="team-history-hero-title" className="team-dest-hero__title">
            Program History
          </h1>
          <p className="team-dest-hero__sub">
            Titles. Heismans. Eras. The Florida ledger — built for the app, not a textbook.
          </p>
        </div>
      </section>

      <div className="rh-frame rh-cc-page team-premium-cc-page team-dest-page">
        <Link href="/vault/team/" className="team-dest-back">
          ← Back to Team hub
        </Link>

        <section className="team-history-board" aria-label="Program hardware">
          {HARDWARE.map((h) => (
            <div key={h.label} className="team-history-board__cell">
              <span className="team-history-board__value">{h.value}</span>
              <span className="team-history-board__label">{h.label}</span>
            </div>
          ))}
        </section>

        <section className="team-history-hardware" aria-labelledby="history-hardware">
          <div className="team-history-section-head">
            <p className="team-dest-page__kicker">Hardware</p>
            <h2 id="history-hardware" className="team-dest-page__h">
              What Gator Nation measures
            </h2>
          </div>
          <div className="team-history-achievements__grid">
            {PROGRAM_ACHIEVEMENTS.slice(0, 4).map((a) => (
              <article key={a.id} className="team-history-achievement">
                <span className="team-history-achievement__stat">{a.stat}</span>
                <h3 className="team-history-achievement__title">{a.label}</h3>
                <ul className="team-history-achievement__years">
                  {a.years.slice(0, 4).map((y) => (
                    <li key={y}>{y}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="team-history-eras" aria-labelledby="history-eras">
          <div className="team-history-section-head">
            <p className="team-dest-page__kicker">Timeline</p>
            <h2 id="history-eras" className="team-dest-page__h">
              Dynasty eras
            </h2>
          </div>
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
            <EraRoom key={era.id} era={era} />
          ))}
        </section>
      </div>
    </TeamElitePageShell>
  );
}
