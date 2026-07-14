'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { LiveTickerItem } from '@/lib/gatornation-live-api';
import { filterExcludedPortalClassItems } from '@/lib/portal-class-filter';
import { applyTickerScrollDuration } from '@/lib/ticker-duration';

type Props = {
  items: LiveTickerItem[];
  refreshKey?: string | null;
};

const TICKER_TEXT_MAX = 140;

function itemKey(item: LiveTickerItem): string {
  return `${item.type}_${item.text.slice(0, 80).toLowerCase()}`;
}

function tickerHeadline(text: string): string {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= TICKER_TEXT_MAX) return clean;
  return `${clean.slice(0, TICKER_TEXT_MAX - 1).trimEnd()}…`;
}

/** Live ticker — real items only. Hidden when quiet (no fake BREAKING stubs). */
export function GNLEliteTicker({ items, refreshKey }: Props): React.ReactElement | null {
  const prevRefreshKey = useRef<string | null>(null);
  const seenKeys = useRef<Set<string>>(new Set());
  const trackRef = useRef<HTMLDivElement>(null);
  const [newKeys, setNewKeys] = useState<Set<string>>(new Set());

  const display = useMemo(
    () =>
      filterExcludedPortalClassItems(
        items,
        (item) => item.text,
        (item) => ({ type: item.type, source: item.source })
      ).slice(0, 12),
    [items]
  );

  const marqueeItems = useMemo(() => {
    if (display.length === 0) return [];
    // Only duplicate for seamless marquee when we have enough real items.
    return display.length >= 2 ? [...display, ...display] : display;
  }, [display]);

  useLayoutEffect(() => {
    // Long beat posts make a fixed 48s loop fly by — scale duration to track width.
    applyTickerScrollDuration(trackRef.current, {
      minSec: 90,
      maxSec: 280,
      pxPerSec: 22,
    });
  }, [marqueeItems]);

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

  if (!display.length) return null;

  return (
    <section className="gv-gnl-ticker-band" aria-label="Live ticker" data-testid="gnl-ticker">
      <div className="gv-gnl-ticker-band__viewport">
        <div ref={trackRef} className="gv-gnl-ticker-band__track" aria-live="polite">
          {marqueeItems.map((item, idx) => {
            const key = itemKey(item);
            const isNew = newKeys.has(key) && idx < display.length;
            return (
              <a
                key={`${key}_${idx}`}
                href={item.url || '/gator-nation-live'}
                className={[
                  'gv-gnl-ticker-band__item',
                  isNew ? 'gv-gnl-ticker-band__item--new' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className="gv-gnl-ticker-band__tag">{item.type}</span>
                <span className="gv-gnl-ticker-band__text">{tickerHeadline(item.text)}</span>
                {item.source ? (
                  <span className="gv-gnl-ticker-band__source">{item.source}</span>
                ) : null}
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
