'use client';

import React from 'react';
import type { LiveTickerProps, TickerTag } from '@/lib/gatornation-live-types';
import { tickerTagEmoji } from '@/lib/gatornation-live-api';

const TAG_CLASS: Record<TickerTag, string> = {
  BREAKING: 'breaking',
  VISIT: 'visit',
  COMMIT: 'commit',
  PORTAL: 'portal',
  RUMOR: 'rumor',
};

export function LiveTicker({ items, loading }: LiveTickerProps): React.ReactElement {
  const fallback: LiveTickerProps['items'] = [
    {
      type: 'BREAKING',
      text: 'GatorNation Live — recruiting, portal, and beat writers updating all day',
      timestamp: new Date().toISOString(),
      source: 'GatorVault',
      url: '/vault/live',
    },
  ];
  const base = items.length ? items : fallback;
  const loop = [...base, ...base];

  if (loading) {
    return (
      <section className="gv-gnl-ticker" aria-label="Live ticker">
        <div className="gv-gnl-ticker__viewport">
          <span className="gv-gnl-ticker__loading">Loading ticker…</span>
        </div>
      </section>
    );
  }

  return (
    <section className="gv-gnl-ticker" aria-label="Live ticker" data-testid="gnl-ticker">
      <div className="gv-gnl-ticker__viewport">
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
      </div>
    </section>
  );
}
