'use client';

import React from 'react';
import { PlayerNavLink } from '@/components/vault/PlayerNavLink';
import { playerProfileRoute } from '@/lib/site-routes';
import type { NilEliteMovementItem } from '@/lib/nil-elite-api';

type Props = {
  items: NilEliteMovementItem[];
};

export function NilMovementFeed({ items }: Props): React.ReactElement {
  return (
    <section className="nil-elite-section" data-testid="nil-movement-feed">
      <header className="nil-elite-section__head">
        <div>
          <h2 className="nil-elite-section__title">Board & commit movement</h2>
          <p className="nil-elite-section__sub">
            Commits, elsewhere outcomes, and confirmed UF board percentages — no filler copy.
          </p>
        </div>
      </header>
      {items.length === 0 ? (
        <p className="rh-cc-empty">No NIL-linked board movement in this window.</p>
      ) : (
        <ul className="nil-feed">
          {items.map((item) => (
            <li key={item.id} className="nil-feed__item">
              <div className="nil-feed__meta">
                <span className="nil-feed__tag">{item.category}</span>
              </div>
              {item.slug ? (
                <PlayerNavLink
                  href={playerProfileRoute(item.slug, 'futurecast')}
                  className="nil-feed__text nil-feed__text--link"
                >
                  {item.text}
                </PlayerNavLink>
              ) : (
                <p className="nil-feed__text">{item.text}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
