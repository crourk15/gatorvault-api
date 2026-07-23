'use client';

import React from 'react';
import type { NilEliteBundle } from '@/lib/nil-elite-api';

type Props = {
  hero: NilEliteBundle['hero'];
  pulse: NilEliteBundle['pulse'];
};

export function NilHero({ hero, pulse }: Props): React.ReactElement {
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
          <div className="nil-trend-dial" aria-label={`${pulse.commits} UF commits`}>
            <div className="nil-trend-dial__center nil-trend-dial__center--static">
              <span className="nil-trend-dial__value">{pulse.commits}</span>
              <span className="nil-trend-dial__label">UF commits</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
