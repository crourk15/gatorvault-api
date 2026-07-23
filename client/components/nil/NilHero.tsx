'use client';

import React from 'react';
import type { NilEliteBundle } from '@/lib/nil-elite-api';

type Props = {
  hero: NilEliteBundle['hero'];
  money?: NilEliteBundle['money'];
};

export function NilHero({ hero, money }: Props): React.ReactElement {
  const pool = hero.poolLabel || money?.poolLabel || '—';
  const caption = hero.poolCaption || 'UF annual pool est.';

  return (
    <section className="nil-hero nil-bleed" data-testid="nil-hero">
      <div className="nil-hero__bg" aria-hidden />
      <div className="nil-hero__inner rh-frame">
        <div className="nil-hero__copy">
          <p className="nil-hero__eyebrow">{hero.eyebrow}</p>
          <h1 className="nil-hero__title">{hero.title}</h1>
          <p className="nil-hero__sub">{hero.sub}</p>
          <p className="nil-hero__collective">
            Collective · <strong>{hero.collective}</strong>
          </p>
        </div>
        <div className="nil-hero__dial-wrap">
          <div className="nil-hero__watermark" aria-hidden>
            UF
          </div>
          <div className="nil-trend-dial" aria-label={`${pool} UF annual pool estimate`}>
            <div className="nil-trend-dial__center nil-trend-dial__center--static">
              <span className="nil-trend-dial__value">{pool}</span>
              <span className="nil-trend-dial__label">{caption}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
