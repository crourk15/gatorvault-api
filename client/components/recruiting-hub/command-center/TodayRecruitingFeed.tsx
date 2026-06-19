'use client';

import React, { useMemo } from 'react';
import type { HeatCheckItem } from '@/lib/recruiting-api';
import type { MovementSummary } from '@/lib/recruiting-movement-api';
import type { HighPriorityIntelItem } from '@/components/recruiting-hub/HighPriorityIntel/types';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import {
  buildIntelFeedItem,
  dedupeIntelFeedItems,
  formatIntelTimestamp,
} from '@/lib/recruiting-intel-feed';

type Props = {
  intelItems: HighPriorityIntelItem[];
  movementSummary: MovementSummary | null;
  staffDashboard: StaffDashboardResponse | null;
  rising: HeatCheckItem[];
};

export function TodayRecruitingFeed({
  intelItems,
  movementSummary,
  staffDashboard,
  rising,
}: Props): React.ReactElement {
  const items = useMemo(() => {
    const raw = [];

    for (const alert of staffDashboard?.alerts ?? []) {
      raw.push(
        buildIntelFeedItem({
          id: `feed-staff-${alert.playerName}-${alert.message}`,
          playerName: alert.playerName,
          headline: `${alert.playerName} — ${alert.message}`,
          timestamp: alert.createdAt,
          category: alert.type === 'VISIT' ? 'Visit' : alert.type === 'OFFER' ? 'Offer' : 'Movement',
          volatile: /volatile|spike/i.test(alert.message),
        })
      );
    }

    for (const item of intelItems) {
      raw.push(
        buildIntelFeedItem({
          id: `feed-intel-${item.slug}`,
          playerName: item.name,
          headline: `${item.name}: ${item.intelSummary}`,
          timestamp: new Date().toISOString(),
          category:
            item.intelType === 'RPM'
              ? 'Offer'
              : item.intelType === 'VISIT'
                ? 'Visit'
                : item.intelType === 'BATTLE'
                  ? 'Movement'
                  : 'Update',
          volatile: item.intelType === 'BATTLE',
        })
      );
    }

    if (movementSummary) {
      raw.push(
        buildIntelFeedItem({
          id: 'feed-movement-summary',
          headline: `UF trending up on ${movementSummary.rising} targets in the movement window`,
          timestamp: movementSummary.lastUpdated,
          category: 'Movement',
        })
      );
    }

    if (rising[0]) {
      raw.push(
        buildIntelFeedItem({
          id: `feed-rising-${rising[0].playerSlug || rising[0].playerName}`,
          playerName: rising[0].playerName,
          headline: `${rising[0].playerName} heating up on the UF board`,
          timestamp: new Date().toISOString(),
          category: 'Movement',
        })
      );
    }

    const deduped = dedupeIntelFeedItems(raw, 12);
    if (deduped.length < 4) {
      deduped.push(
        buildIntelFeedItem({
          id: 'feed-placeholder',
          headline: 'Recruiting command center live — intel refreshes every 90 seconds',
          category: 'Update',
        })
      );
    }

    return deduped;
  }, [intelItems, movementSummary, rising, staffDashboard?.alerts]);

  return (
    <section className="rh-cc-feed" data-testid="rh-cc-today-feed">
      <div className="rh-cc-feed__inner rh-frame">
        <h2 className="rh-cc-feed__title">Today&apos;s Recruiting Feed</h2>
        <div className="rh-cc-feed__track" tabIndex={0} role="list" aria-label="Live recruiting feed">
          {items.map((item) => (
            <div key={item.id} className="rh-cc-feed__item" role="listitem">
              <span className="rh-cc-feed__icon" aria-hidden>
                {item.icon}
              </span>
              <div className="rh-cc-feed__body">
                <span className="rh-cc-feed__text">{item.headline}</span>
                <span className="rh-cc-feed__meta">
                  {item.category} · {formatIntelTimestamp(item.timestamp)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
