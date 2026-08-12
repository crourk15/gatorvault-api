'use client';

/**
 * Full Vault scouting block for player profiles.
 * Film-desk composition: lead take → traits → Comp / Projection pair.
 * Body is Film-tier (trial unlocks); header stays as Locker teaser.
 */
import React from 'react';
import { coerceDisplayText } from '../../../lib/coerce-text';
import type { FullProfileVaultScouting } from '@/lib/player-full-profile-api';
import { InsiderPaywall } from '@/components/futurecast/InsiderPaywall';

type Props = {
  scouting?: FullProfileVaultScouting | null;
};

const FILM_SCOUTING_PAYWALL = {
  message:
    'Film Room unlocks Vault Scouting — tape traits, player comp, and projection for this recruit.',
  ctaLabel: 'Unlock Film Room',
} as const;

export function VaultScoutingSection({ scouting }: Props): React.ReactElement | null {
  if (!scouting) return null;

  const evaluation = coerceDisplayText(scouting.evaluation);
  const comparison = coerceDisplayText(scouting.comparison);
  const projection = coerceDisplayText(scouting.projection);
  const strengths = Array.isArray(scouting.strengths)
    ? scouting.strengths.map((s) => coerceDisplayText(s)).filter(Boolean)
    : [];

  if (!evaluation && !comparison && !projection && !strengths.length) return null;

  const hasPair = Boolean(comparison || projection);

  return (
    <section className="fc-profile-section fc-vault-scouting" data-testid="vault-scouting-section">
      <header className="fc-vault-scouting__head">
        <h2>Vault Scouting</h2>
        <p className="fc-vault-scouting__lede">How Florida sees this get on film</p>
      </header>

      <InsiderPaywall variant="overlay" {...FILM_SCOUTING_PAYWALL}>
        {evaluation ? (
          <div className="fc-vault-scouting__lead">
            <p className="fc-vault-scouting__body fc-vault-scouting__body--lead">{evaluation}</p>
          </div>
        ) : null}

        {strengths.length ? (
          <div className="fc-vault-scouting__traits-wrap">
            <p className="fc-vault-scouting__kicker">On tape</p>
            <ul className="fc-vault-scouting__traits">
              {strengths.map((trait) => (
                <li key={trait}>{trait}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {hasPair ? (
          <div className="fc-vault-scouting__pair">
            {comparison ? (
              <div className="fc-vault-scouting__card">
                <p className="fc-vault-scouting__kicker">Player Comp</p>
                <p className="fc-vault-scouting__body">{comparison}</p>
              </div>
            ) : null}
            {projection ? (
              <div className="fc-vault-scouting__card fc-vault-scouting__card--projection">
                <p className="fc-vault-scouting__kicker">Projection</p>
                <p className="fc-vault-scouting__body">{projection}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </InsiderPaywall>
    </section>
  );
}
