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

    for (const p of players.slice(0, 4)) {
      const pred = p.predictors?.[0];
      if (pred) {
        const pct = pred.score <= 1 ? Math.round(pred.score * 100) : Math.round(pred.score);
        feed.push({
          icon: '🎯',
          text: `${pred.name} → UF FutureCast for ${p.name} (${pct}%)`,
        });
      }
    }

    for (const riser of movementIntel?.risers?.slice(0, 2) ?? []) {
      feed.push({
        icon: '🔁',
        text: `Prediction trending up for ${riser.name} (+${riser.delta}%)`,
      });
    }

    for (const item of intelItems.slice(0, 3)) {
      if (item.intelType === 'BATTLE') {
        feed.push({
          icon: '⚠️',
          text: `Battle intensifying vs Georgia for ${item.position} target ${item.name}`,
        });
      } else if (item.intelType === 'VISIT') {
        feed.push({
          icon: '📍',
          text: `Official visit scheduled for ${item.name}`,
        });
      }
    }

    for (const alert of staffDashboard?.alerts ?? []) {
      feed.push({
        icon: alert.type === 'VISIT' ? '📍' : alert.type === 'OFFER' ? '🎯' : '⚠️',
        text: `${alert.playerName} — ${alert.message}`,
      });
    }

    for (const faller of movementIntel?.fallers?.slice(0, 1) ?? []) {
      feed.push({
        icon: '🔁',
        text: `Prediction flipped from Georgia → UF on ${faller.name}`,
      });
    }

    if (feed.length < 4) {
      feed.push({
        icon: 'ℹ️',
        text: 'FutureCast Lab live — predictions refresh every 90 seconds',
      });
    }

    return feed.slice(0, 16);
  }, [intelItems, movementIntel, players, staffDashboard?.alerts]);

  return (
    <section className="fc-lab-feed fc-lab-bleed" data-testid="fc-lab-live-feed">
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
