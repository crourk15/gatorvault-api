'use client';

import React, { useMemo } from 'react';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import type { HighPriorityIntelItem } from '@/components/recruiting-hub/HighPriorityIntel/types';
import type { HomeMovementIntelData } from '@/lib/vault-home-api';
import type { StaffDashboardResponse } from '@/lib/staff-api';

type Props = {
  players: HighPriorityPlayer[];
  intelItems: HighPriorityIntelItem[];
  movementIntel: HomeMovementIntelData | null;
  staffDashboard: StaffDashboardResponse | null;
};

type FeedItem = { icon: string; text: string };

export function FutureCastLiveFeed({
  players,
  intelItems,
  movementIntel,
  staffDashboard,
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

    for (const mover of movementIntel?.risers?.slice(0, 3) ?? []) {
      feed.push({
        icon: '📈',
        text: `${mover.name} rising — UF prob +${mover.delta}%`,
      });
    }

    for (const p of players.slice(0, 2)) {
      if (p.predictors?.[0]) {
        feed.push({
          icon: '🎯',
          text: `${p.predictors[0].name} signal on ${p.name}`,
        });
      }
    }

    if (feed.length < 4) {
      feed.push({
        icon: 'ℹ️',
        text: 'FutureCast Lab live — intel refreshes every 90 seconds',
      });
    }

    return feed.slice(0, 14);
  }, [intelItems, movementIntel, players, staffDashboard?.alerts]);

  return (
    <section className="fc-lab-feed" data-testid="fc-lab-live-feed">
      <div className="fc-lab-feed__inner rh-frame">
        <h2 className="fc-lab-feed__title">FutureCast Live Feed</h2>
        <div className="fc-lab-feed__track" tabIndex={0} role="list" aria-label="FutureCast live feed">
          {items.map((item, i) => (
            <div key={`${item.text}-${i}`} className="fc-lab-feed__item" role="listitem">
              <span className="fc-lab-feed__icon" aria-hidden>
                {item.icon}
              </span>
              <span className="fc-lab-feed__text">{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
