'use client';

import React from 'react';
import { useRecruitingClassYear } from '@/lib/recruiting-class-year-store';
import { VAULT_PILLAR_ROUTES } from '@/lib/vault-route-map';

/** Gateway to FutureCast closing board — avoids cloning Flip Watch on Recruiting. */
export function FutureCastClosingCta(): React.ReactElement {
  const { activeYear } = useRecruitingClassYear();

  return (
    <section className="rh-card rh-fc-closing-cta" data-testid="rh-fc-closing-cta">
      <div className="rh-fc-closing-cta__copy">
        <h3 className="rh-fc-closing-cta__title">Chase the closing board on FutureCast</h3>
      </div>
      <a href={VAULT_PILLAR_ROUTES.futurecast} className="rh-fc-closing-cta__link">
        Open FutureCast {activeYear} Closing →
      </a>
    </section>
  );
}
