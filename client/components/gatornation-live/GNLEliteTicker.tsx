'use client';

import React, { useEffect, useRef } from 'react';
import type { LiveTickerItem } from '@/lib/gatornation-live-api';
import type { TickerTag } from '@/lib/gatornation-live-types';

const TAG_SLUG: Record<TickerTag, string> = {
  BREAKING: 'breaking',
  VISIT: 'visit',
  COMMIT: 'commit',
  PORTAL: 'portal',
  RUMOR: 'rumor',
  TEAM: 'team',
  PODCAST: 'podcast',
};

const FALLBACK: LiveTickerItem[] = [
  {
    type: 'BREAKING',
    text: 'GatorNation Live — recruiting, portal, and beat writers updating all day',
    timestamp: new Date().toISOString(),
    source: 'GatorVault',
    url: '/gator-nation-live',
  },
];

type Props = {
  items: LiveTickerItem[];
  refreshKey?: string | null;
};

/** UF Premium live ticker — horizontal scroll desktop, vertical stack mobile. */
export function GNLEliteTicker({ items, refreshKey }: Props): React.ReactElement {
  const prevKey = useRef<string | null>(null);
  const pulse = refreshKey && refreshKey !== prevKey.current;

  useEffect(() => {
    if (refreshKey) prevKey.current = refreshKey;
  }, [refreshKey]);

  const display = items.length ? items : FALLBACK;

  return (
    <section
      className={`gv-gnl-elite-card gv-gnl-elite-ticker${pulse ? ' gv-gnl-elite-ticker--pulse' : ''}`}
      aria-label="Live ticker"
      data-testid="gnl-ticker"
    >
      <header className="gv-gnl-elite-card__head">
        <h2 className="gv-gnl-elite-card__title">Live Ticker</h2>
        <p className="gv-gnl-elite-card__sub">Real-time intel across recruiting, portal, and the beat</p>
      </header>
      <div className="gv-gnl-elite-ticker__track">
        {display.map((item, idx) => (
          <a
            key={`${item.type}_${idx}_${item.text.slice(0, 20)}`}
            href={item.url || '/gator-nation-live'}
            className={`gv-gnl-elite-ticker__item gv-gnl-elite-ticker__item--${TAG_SLUG[item.type]}`}
          >
            <span className="gv-gnl-elite-ticker__tag">{item.type}</span>
            <span className="gv-gnl-elite-ticker__text">{item.text}</span>
            <span className="gv-gnl-elite-ticker__source">{item.source}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
