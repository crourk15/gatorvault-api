'use client';

import React from 'react';
import type { NilEliteBundle } from '@/lib/nil-elite-api';

type Props = {
  hero: NilEliteBundle['hero'];
  money?: NilEliteBundle['money'];
  desk?: NilEliteBundle['desk'];
};

export function NilHero({ hero, money, desk }: Props): React.ReactElement {
  const pool = hero.poolLabel || money?.schoolMarketLabel || money?.poolLabel || '—';
  const caption = hero.poolCaption || 'All-sport school market';
  const football = money?.footballMarketLabel || '—';
  const sec = money?.secRank != null ? `#${money.secRank} SEC` : '—';
  const nat = money?.nationalRank != null ? `#${money.nationalRank} Natl` : '—';

  return (
    <section className="nil-hero nil-hero--desk nil-bleed" data-testid="nil-hero">
      <div className="nil-hero__bg" aria-hidden />
      <div className="nil-hero__desk rh-frame">
        <div className="nil-hero__copy">
          <p className="nil-hero__eyebrow">{hero.eyebrow}</p>
          <h1 className="nil-hero__title">{hero.title}</h1>
          <p className="nil-hero__sub">{desk?.headline || hero.sub}</p>
          <p className="nil-hero__collective">
            Collective · <strong>{hero.collective}</strong>
            {desk?.provider ? (
              <>
                <span className="nil-hero__dot">·</span>
                {desk.provider}
              </>
            ) : null}
          </p>
          <div className="nil-hero__chips" aria-label="Market chips">
            <span className="nil-chip">
              Football <strong>{football}</strong>
            </span>
            <span className="nil-chip">
              {sec}
            </span>
            <span className="nil-chip">
              {nat}
            </span>
            {money?.topEarnerValue ? (
              <span className="nil-chip nil-chip--accent">
                Lead <strong>{money.topEarnerValue}</strong>
              </span>
            ) : null}
          </div>
        </div>

        <div className="nil-hero__dial-wrap">
          <div className="nil-hero__watermark" aria-hidden>
            UF
          </div>
          <div className="nil-trend-dial" aria-label={`${pool} all-sport school market`}>
            <div className="nil-trend-dial__center nil-trend-dial__center--static">
              <span className="nil-trend-dial__value">{pool}</span>
              <span className="nil-trend-dial__label">{caption}</span>
            </div>
          </div>
        </div>

        {desk?.bullets?.length ? (
          <aside className="nil-hero__narrative" aria-label="UF market narrative">
            <p className="nil-hero__narrative-label">Market read</p>
            <ul className="nil-desk-bullets">
              {desk.bullets.slice(0, 4).map((b) => (
                <li key={b.id} className={`nil-desk-bullets__item nil-desk-bullets__item--${b.tone}`}>
                  {b.text}
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
