'use client';

import React, { useLayoutEffect, useRef } from 'react';
import type { LiveTickerProps, TickerTag } from '@/lib/gatornation-live-types';
import { tickerTagEmoji } from '@/lib/gatornation-live-api';
import { applyTickerScrollDuration } from '@/lib/ticker-duration';

const TAG_CLASS: Record<TickerTag, string> = {
  BREAKING: 'breaking',
  VISIT: 'visit',
  COMMIT: 'commit',
  PORTAL: 'portal',
  RUMOR: 'rumor',
  TEAM: 'team',
  PODCAST: 'podcast',
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
  const trackRef = useRef<HTMLDivElement>(null);
  const loop = [...items, ...items];

  useLayoutEffect(() => {
    applyTickerScrollDuration(trackRef.current);
  }, [items]);

  return (
    <div ref={trackRef} className="gv-gnl-ticker__track gv-live-ticker__scroll">
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
          <span className="gv-gnl-ticker__text gv-live-ticker__text">{item.text}</span>
        </a>
      ))}
    </div>
  );
}

export function LiveTicker({ items }: LiveTickerProps): React.ReactElement {
  const display = items.length ? items : FIRST_PAINT_FALLBACK;

  return (
    <section className="gv-gnl-ticker gv-live-ticker" aria-label="Live ticker" data-testid="gnl-ticker">
      <span className="gv-gnl-ticker__live-badge" aria-hidden="true">
        LIVE
      </span>
      <div className="gv-gnl-ticker__viewport">
        <TickerTrack items={display} />
      </div>
    </section>
  );
}
