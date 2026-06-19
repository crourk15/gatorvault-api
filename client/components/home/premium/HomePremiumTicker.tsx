'use client';

import React, { useEffect, useRef } from 'react';
import type { TickerResponse } from '@/lib/vault-home-api';
import { applyTickerScrollDuration } from '@/lib/ticker-duration';
import { SITE_ROUTES } from '@/lib/site-routes';

type Props = {
  ticker: TickerResponse | null;
  loading?: boolean;
};

function TickerItem({
  category,
  text,
  url,
}: {
  category?: string;
  text: string;
  url?: string;
}): React.ReactElement {
  return (
    <a href={url || SITE_ROUTES.gatorNationLive} className="uf-premium-ticker__item">
      <strong>{category || 'UPDATE'}</strong>
      <span>{text}</span>
      <span className="uf-premium-ticker__sep" aria-hidden="true">
        •
      </span>
    </a>
  );
}

/** UF Premium home live ticker — navy strip, orange accent, live-dashboard copy. */
export function HomePremiumTicker({ ticker, loading }: Props): React.ReactElement {
  const trackRef = useRef<HTMLDivElement>(null);
  const items = ticker?.items ?? [];
  const loop = items.length ? [...items, ...items] : [];

  useEffect(() => {
    if (!trackRef.current || loop.length === 0) return;
    applyTickerScrollDuration(trackRef.current);
  }, [loop.length, loading]);

  if (loading && items.length === 0) {
    return <div className="uf-premium-ticker uf-premium-ticker--skeleton" aria-hidden="true" />;
  }

  if (items.length === 0) {
    return (
      <div className="uf-premium-ticker" data-testid="home-premium-ticker">
        <span className="uf-premium-ticker__badge">LIVE</span>
        <p className="uf-premium-ticker__empty">Live intel updating — check GatorNation Live for the latest.</p>
      </div>
    );
  }

  return (
    <div className="uf-premium-ticker" data-testid="home-premium-ticker" aria-label="Live ticker">
      <span className="uf-premium-ticker__badge">LIVE</span>

      {/* Mobile: wrap items cleanly without horizontal scroll */}
      <div className="uf-premium-ticker__wrap" aria-hidden={false}>
        {items.map((item) => (
          <TickerItem
            key={item.id ?? item.text}
            category={item.category}
            text={item.text}
            url={item.url}
          />
        ))}
      </div>

      {/* Desktop: marquee scroll */}
      <div className="uf-premium-ticker__viewport">
        <div ref={trackRef} className="uf-premium-ticker__track">
          {loop.map((item, idx) => (
            <TickerItem
              key={`${item.id ?? item.text}_${idx}`}
              category={item.category}
              text={item.text}
              url={item.url}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
