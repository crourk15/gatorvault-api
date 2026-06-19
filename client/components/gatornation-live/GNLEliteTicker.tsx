'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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

function itemKey(item: LiveTickerItem): string {
  return `${item.type}_${item.text.slice(0, 80).toLowerCase()}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d
    .toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
    .toUpperCase();
}

/** UF Premium live ticker — horizontal scroll desktop, vertical stack mobile. */
export function GNLEliteTicker({ items, refreshKey }: Props): React.ReactElement {
  const prevRefreshKey = useRef<string | null>(null);
  const seenKeys = useRef<Set<string>>(new Set());
  const [newKeys, setNewKeys] = useState<Set<string>>(new Set());

  const display = useMemo(() => (items.length ? items : FALLBACK), [items]);

  useEffect(() => {
    const keys = display.map(itemKey);
    const isRefresh =
      refreshKey != null &&
      prevRefreshKey.current != null &&
      prevRefreshKey.current !== refreshKey;

    if (isRefresh) {
      const fresh = new Set(keys.filter((key) => !seenKeys.current.has(key)));
      if (fresh.size > 0) {
        setNewKeys(fresh);
        const timer = window.setTimeout(() => setNewKeys(new Set()), 400);
        seenKeys.current = new Set(keys);
        prevRefreshKey.current = refreshKey;
        return () => window.clearTimeout(timer);
      }
    }

    seenKeys.current = new Set(keys);
    if (refreshKey != null) prevRefreshKey.current = refreshKey;
  }, [refreshKey, display]);

  return (
    <section
      className="gv-gnl-elite-card gv-gnl-elite-ticker"
      aria-label="Live ticker"
      data-testid="gnl-ticker"
    >
      <header className="gv-gnl-elite-card__head">
        <h2 className="gv-gnl-elite-card__title">Live Ticker</h2>
        <p className="gv-gnl-elite-card__sub">Real-time intel across recruiting, portal, and the beat</p>
      </header>
      <div className="gv-gnl-elite-ticker__track">
        {display.map((item, idx) => {
          const key = itemKey(item);
          return (
          <a
            key={`${key}_${idx}`}
            href={item.url || '/gator-nation-live'}
            className={[
              'gv-gnl-elite-ticker__item',
              `gv-gnl-elite-ticker__item--${TAG_SLUG[item.type]}`,
              newKeys.has(key) ? 'gv-gnl-elite-ticker__item--new' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <p className="gv-gnl-elite-ticker__line">
              <span className="gv-gnl-elite-ticker__tag">[{item.type}]</span>
              <span className="gv-gnl-elite-ticker__text">{item.text}</span>
            </p>
            <div className="gv-gnl-elite-ticker__meta">
              <span className="gv-gnl-elite-ticker__source">{item.source}</span>
              {item.timestamp ? (
                <span className="gv-gnl-elite-ticker__timestamp">{formatTime(item.timestamp)}</span>
              ) : null}
            </div>
          </a>
          );
        })}
      </div>
    </section>
  );
}
