'use client';

import { useEffect, useState } from 'react';
import { buildMovementFeedItems, timeAgo } from '@/components/home/home-utils';
import { fetchLiveTicker, fetchMovementPreview, fetchPersonalizedHints } from '@/lib/vault-home-api';

export type HomeAlert = {
  id: string;
  type: 'futurecast' | 'analyst' | 'portal' | 'nil' | 'intel';
  text: string;
  timeAgo: string;
  isNew: boolean;
};

function mapCategory(category: string): HomeAlert['type'] {
  if (category === 'nil') return 'nil';
  if (category === 'portal') return 'portal';
  if (category === 'staff' || category === 'beat') return 'analyst';
  if (category === 'recruiting') return 'intel';
  return 'futurecast';
}

function isNewAlert(timeLabel: string): boolean {
  const normalized = timeLabel.trim().toLowerCase();
  return normalized === 'new' || normalized === 'just now' || normalized === 'live';
}

export function useLiveAlertsFeed(): HomeAlert[] | null {
  const [alerts, setAlerts] = useState<HomeAlert[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([fetchLiveTicker(), fetchMovementPreview(), fetchPersonalizedHints()])
      .then(([ticker, movement, personalized]) => {
        if (cancelled) return;

        const rows: HomeAlert[] = [
          ...(ticker.items ?? []).slice(0, 8).map((item) => {
            const label = timeAgo(ticker.updatedAt) || 'Just now';
            return {
              id: item.id,
              type: mapCategory(item.category),
              text: item.text,
              timeAgo: label,
              isNew: isNewAlert(label),
            };
          }),
          ...buildMovementFeedItems(movement).slice(0, 4).map((item) => ({
            id: item.id,
            type: 'intel' as const,
            text: item.title,
            timeAgo: 'Live',
            isNew: true,
          })),
          ...(personalized?.alerts ?? []).slice(0, 3).map((a) => ({
            id: a.id,
            type: 'analyst' as const,
            text: a.title,
            timeAgo: 'New',
            isNew: true,
          })),
        ].slice(0, 10);

        setAlerts(rows);
      })
      .catch(() => {
        if (!cancelled) setAlerts([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return alerts;
}
