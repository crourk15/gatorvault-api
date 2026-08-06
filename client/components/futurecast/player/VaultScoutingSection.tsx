'use client';

/**
 * Full Vault scouting block for player profiles.
 * Organized reading order: Evaluation → Traits → Comp / Projection pair.
 */
import React from 'react';
import { coerceDisplayText } from '../../../lib/coerce-text';
import type { FullProfileVaultScouting } from '@/lib/player-full-profile-api';

type Props = {
  scouting?: FullProfileVaultScouting | null;
};

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
        <p className="fc-vault-scouting__lede">Film desk · how Florida sees this get</p>
      </header>

      {evaluation ? (
        <div className="fc-vault-scouting__lead">
          <p className="fc-vault-scouting__kicker">Evaluation</p>
          <p className="fc-vault-scouting__body">{evaluation}</p>
        </div>
      ) : null}

      {strengths.length ? (
        <div className="fc-vault-scouting__traits-wrap">
          <p className="fc-vault-scouting__kicker">Traits</p>
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
              <p className="fc-vault-scouting__kicker">Vault Player Comp</p>
              <p className="fc-vault-scouting__body">{comparison}</p>
            </div>
          ) : null}
          {projection ? (
            <div className="fc-vault-scouting__card fc-vault-scouting__card--projection">
              <p className="fc-vault-scouting__kicker">Vault Projection</p>
              <p className="fc-vault-scouting__body">{projection}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
