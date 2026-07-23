'use client';

import React from 'react';
import { PlayerNavLink } from '@/components/vault/PlayerNavLink';
import { playerProfileRoute } from '@/lib/site-routes';
import type { NilEliteDesk } from '@/lib/nil-elite-api';

type Props = {
  desk: NilEliteDesk;
};

export function NilDeskIntel({ desk }: Props): React.ReactElement {
  return (
    <section className="nil-elite-section" data-testid="nil-desk-intel">
      <header className="nil-elite-section__head">
        <div>
          <h2 className="nil-elite-section__title">NIL desk feed</h2>
          <p className="nil-elite-section__sub">
            Valuations, board movement, and portal pressure — one intel rail.
          </p>
        </div>
      </header>
      <div className="nil-desk-intel">
        {desk.intel.length === 0 ? (
          <p className="rh-cc-empty">No desk intel in this window.</p>
        ) : (
          desk.intel.map((item) => {
            const body = (
              <>
                <span className={`nil-desk-intel__badge nil-desk-intel__badge--${item.category.toLowerCase()}`}>
                  {item.category}
                </span>
                <span className="nil-desk-intel__text">{item.text}</span>
              </>
            );
            return (
              <article key={item.id} className="nil-desk-intel__row">
                {item.slug ? (
                  <PlayerNavLink
                    href={playerProfileRoute(item.slug, 'team')}
                    className="nil-desk-intel__link"
                  >
                    {body}
                  </PlayerNavLink>
                ) : (
                  <div className="nil-desk-intel__link">{body}</div>
                )}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
