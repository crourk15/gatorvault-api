'use client';

import React, { useMemo } from 'react';
import type { HeatCheckItem } from '@/lib/recruiting-api';
import type { MovementSummary } from '@/lib/recruiting-movement-api';
import type { HighPriorityIntelItem } from '@/components/recruiting-hub/HighPriorityIntel/types';
import type { StaffDashboardResponse } from '@/lib/staff-api';

type Props = {
  intelItems: HighPriorityIntelItem[];
  movementSummary: MovementSummary | null;
  staffDashboard: StaffDashboardResponse | null;
  rising: HeatCheckItem[];
};

type FeedItem = { icon: string; text: string };

export function TodayRecruitingFeed({
  intelItems,
  movementSummary,
  staffDashboard,
  rising,
}: Props): React.ReactElement {
  const items = useMemo(() => {
    const feed: FeedItem[] = [];

    for (const alert of staffDashboard?.alerts ?? []) {
      feed.push({
        icon: alert.type === 'VISIT' ? '📍' : alert.type === 'OFFER' ? '🎯' : '⚠️',
        text: `${alert.playerName} — ${alert.message}`,
      });
    }

    for (const item of intelItems.slice(0, 4)) {
      feed.push({
        icon:
          item.intelType === 'RPM'
            ? '🎯'
            : item.intelType === 'VISIT'
              ? '📍'
              : item.intelType === 'BATTLE'
                ? '⚠️'
                : '🔥',
        text: `${item.name}: ${item.intelSummary}`,
      });
    }

    if (movementSummary) {
      feed.push({
        icon: '🔥',
        text: `UF trending up on ${movementSummary.rising} targets in the movement window`,
      });
    }

    if (rising[0]) {
      feed.push({
        icon: '📈',
        text: `${rising[0].playerName} heating up on the UF board`,
      });
    }

    if (feed.length < 4) {
      feed.push({
        icon: 'ℹ️',
        text: 'Recruiting command center live — intel refreshes every 90 seconds',
      });
    }

    return feed.slice(0, 12);
  }, [intelItems, movementSummary, rising, staffDashboard?.alerts]);

  return (
    <section className="rh-cc-feed" data-testid="rh-cc-today-feed">
      <div className="rh-cc-feed__inner rh-frame">
        <h2 className="rh-cc-feed__title">Today&apos;s Recruiting Feed</h2>
        <div className="rh-cc-feed__track" tabIndex={0} role="list" aria-label="Live recruiting feed">
          {items.map((item, i) => (
            <div key={`${item.text}-${i}`} className="rh-cc-feed__item" role="listitem">
              <span className="rh-cc-feed__icon" aria-hidden>
                {item.icon}
              </span>
              <span className="rh-cc-feed__text">{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
