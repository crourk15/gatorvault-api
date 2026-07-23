'use client';

import React from 'react';
import { PlayerNavLink } from '@/components/vault/PlayerNavLink';
import { playerProfileRoute } from '@/lib/site-routes';
import type { NilEliteRosterEarner } from '@/lib/nil-elite-api';

type Props = {
  earners: NilEliteRosterEarner[];
};

export function NilRosterEarners({ earners }: Props): React.ReactElement {
  return (
    <section className="nil-elite-section" data-testid="nil-roster-earners">
      <header className="nil-elite-section__head">
        <div>
          <h2 className="nil-elite-section__title">UF Roster NIL</h2>
          <p className="nil-elite-section__sub">
            Top current roster valuations from the Vault model (stars, role, transfer premium) — not
            audited contracts.
          </p>
        </div>
      </header>

      {earners.length === 0 ? (
        <p className="rh-cc-empty">No roster NIL valuations loaded.</p>
      ) : (
        <ol className="nil-earner-list">
          {earners.map((player, idx) => {
            const href = player.slug ? playerProfileRoute(player.slug, 'team') : undefined;
            const body = (
              <>
                <span className="nil-earner-list__rank">#{idx + 1}</span>
                <span className="nil-earner-list__identity">
                  <strong className="nil-earner-list__name">{player.name}</strong>
                  <span className="nil-earner-list__meta">
                    {player.position}
                    {player.stars != null ? ` · ${player.stars}★` : ''}
                    {player.depthChartTier ? ` · ${player.depthChartTier}` : ''}
                  </span>
                </span>
                <span className="nil-earner-list__val">
                  <span className="nil-earner-list__val-label">Vault est.</span>
                  <strong>{player.nilValuation}</strong>
                </span>
              </>
            );
            return (
              <li key={player.id} className="nil-earner-list__item">
                {href ? (
                  <PlayerNavLink href={href} className="nil-earner-list__link">
                    {body}
                  </PlayerNavLink>
                ) : (
                  <div className="nil-earner-list__link">{body}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
