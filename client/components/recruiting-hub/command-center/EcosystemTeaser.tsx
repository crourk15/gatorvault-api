'use client';

import React from 'react';
import { VAULT_PILLAR_ROUTES } from '@/lib/vault-route-map';
import { ModuleShell } from './primitives';

export function EcosystemTeaser(): React.ReactElement {
  return (
    <ModuleShell
      title="GatorVault Ecosystem"
      sub="Live media and GameDay access from the recruiting hub."
      className="rh-cc-module--compact"
      testId="rh-cc-ecosystem-teaser"
    >
      <div className="rh-cc-ecosystem">
        <a href={VAULT_PILLAR_ROUTES.liveFeed} className="rh-cc-ecosystem__tile rh-cc-ecosystem__tile--live">
          <span className="rh-cc-ecosystem__icon" aria-hidden>
            📡
          </span>
          <span className="rh-cc-ecosystem__label">GatorNation Live</span>
          <span className="rh-cc-ecosystem__desc">Beat writers, commits, and live recruiting pulse</span>
          <span className="rh-cc-ecosystem__cta">Open Live Hub →</span>
        </a>
        <a href={VAULT_PILLAR_ROUTES.schedule} className="rh-cc-ecosystem__tile rh-cc-ecosystem__tile--tickets">
          <span className="rh-cc-ecosystem__icon" aria-hidden>
            🎟️
          </span>
          <span className="rh-cc-ecosystem__label">Schedule</span>
          <span className="rh-cc-ecosystem__desc">GameDay planning and ticket links for UF home games</span>
          <span className="rh-cc-ecosystem__cta">View Schedule →</span>
        </a>
      </div>
    </ModuleShell>
  );
}
