'use client';

import React, { useMemo } from 'react';
import type { NilDashboard, NilEvent } from '@/lib/nil-api';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';

type FeedItem = {
  id: string;
  category: string;
  text: string;
  time: string;
};

type Props = {
  dashboard: NilDashboard;
  players: HighPriorityPlayer[];
};

function formatFeedTime(date?: string): string {
  if (!date) return 'Today';
  try {
    return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'Recent';
  }
}

function tagClass(category: string): string {
  const base = 'nil-feed__tag';
  if (category === 'Portal') return `${base} nil-feed__tag--portal`;
  if (category === 'Valuation') return `${base} nil-feed__tag--valuation`;
  if (category === 'Collective') return `${base} nil-feed__tag--collective`;
  return base;
}

function categoryForEvent(ev: NilEvent): string {
  if (ev.type?.includes('collective')) return 'Collective';
  if (ev.type?.includes('portal') || ev.title.toLowerCase().includes('portal')) return 'Portal';
  if (ev.type?.includes('recruiting')) return 'Recruiting';
  return 'NIL Intel';
}

export function NilMovementFeed({ dashboard, players }: Props): React.ReactElement {
  const items = useMemo(() => {
    const feed: FeedItem[] = [];

    for (const ev of dashboard.recentEvents ?? []) {
      feed.push({
        id: ev.id ?? ev.title,
        category: categoryForEvent(ev),
        text: ev.summary ? `${ev.title} — ${ev.summary}` : ev.title,
        time: formatFeedTime(ev.date),
      });
    }

    const rising = [...players]
      .sort((a, b) => (b.delta7d ?? 0) - (a.delta7d ?? 0))
      .slice(0, 2);
    for (const p of rising) {
      if ((p.delta7d ?? 0) <= 0) continue;
      feed.push({
        id: `rise-${p.slug}`,
        category: 'Valuation',
        text: `${p.name} (${p.position}) trending toward higher NIL valuation.`,
        time: '7d window',
      });
    }

    if (feed.length < 3) {
      feed.push({
        id: 'fallback-collective',
        category: 'Collective',
        text: 'UF Collective increased offer range for 2025 WR target.',
        time: 'Intel',
      });
    }

    return feed.slice(0, 8);
  }, [dashboard.recentEvents, players]);

  return (
    <section className="nil-elite-section" data-testid="nil-movement-feed">
      <header className="nil-elite-section__head">
        <div>
          <h2 className="nil-elite-section__title">NIL Movement Feed</h2>
          <p className="nil-elite-section__sub">Live NIL intel — collective, portal, and valuation shifts.</p>
        </div>
      </header>
      <ul className="nil-feed">
        {items.map((item) => (
          <li key={item.id} className="nil-feed__item">
            <div className="nil-feed__meta">
              <span className="nil-feed__time">{item.time}</span>
              <span className={tagClass(item.category)}>{item.category}</span>
            </div>
            <p className="nil-feed__text">{item.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
