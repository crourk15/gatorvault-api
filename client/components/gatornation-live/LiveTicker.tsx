'use client';

import React from 'react';
import type { LiveTickerProps, TickerTag } from '@/lib/gatornation-live-types';
import { tickerTagEmoji } from '@/lib/gatornation-live-api';
import { useHydrated } from '@/hooks/useHydrated';

const TAG_CLASS: Record<TickerTag, string> = {
  BREAKING: 'breaking',
  VISIT: 'visit',
  COMMIT: 'commit',
  PORTAL: 'portal',
  RUMOR: 'rumor',
};

const FIRST_PAINT_FALLBACK: LiveTickerProps['items'] = [
  {
    type: 'BREAKING',
    text: 'GatorNation Live — recruiting, portal, and beat writers updating all day',
    timestamp: new Date().toISOString(),
    source: 'GatorVault',
    url: '/vault/live',
  },
  {
    type: 'COMMIT',
    text: 'Florida recruiting board updating in real time — commits, visits, and portal intel',
    timestamp: new Date().toISOString(),
    source: 'GatorVault',
    url: '/vault/recruiting',
  },
];

function TickerTrack({ items }: { items: LiveTickerProps['items'] }): React.ReactElement {
  const loop = [...items, ...items];
  return (
    <div className="gv-gnl-ticker__track">
      {loop.map((item, idx) => (
        <a
          key={`${item.type}_${idx}_${item.text.slice(0, 24)}`}
          href={item.url || '/vault/live'}
          className="gv-gnl-ticker__item"
        >
          <span className="gv-gnl-ticker__emoji" aria-hidden="true">
            {tickerTagEmoji(item.type)}
          </span>
          <span className={`gv-gnl-ticker__tag gv-gnl-ticker__tag--${TAG_CLASS[item.type]}`}>
            {item.type}
          </span>
          <span className="gv-gnl-ticker__text">{item.text}</span>
        </a>
      ))}
    </div>
  );
}

export function LiveTicker({ items }: LiveTickerProps): React.ReactElement {
  const hydrated = useHydrated();
  const display = items.length ? items : FIRST_PAINT_FALLBACK;

  return (
    <section
      className={`gv-gnl-ticker${hydrated ? ' is-ready' : ''}`}
      aria-label="Live ticker"
      data-testid="gnl-ticker"
    >
      <span className="gv-gnl-ticker__live-badge" aria-hidden="true">
        LIVE
      </span>
      <div className="gv-gnl-ticker__viewport">
        <TickerTrack items={display} />
      </div>
    </section>
  );
}
