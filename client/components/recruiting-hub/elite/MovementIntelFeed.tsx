'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { RhHubMovementFeedItem } from '@/lib/recruiting-hub-elite-api';
import type { MovementIntelResponse } from '@/lib/movement-intel-types';
import { fetchMovementIntel } from '@/lib/recruiting-ui-api';
import { playerHref } from '@/lib/player-link';
import { ACTIVE_RECRUITING_CLASS_YEAR } from '@/lib/recruiting-cycle';

const EVENT_LABELS: Record<RhHubMovementFeedItem['event'], string> = {
  up: 'Trending Up',
  down: 'Trending Down',
  visit: 'Visit Update',
  offer: 'Offer',
  intel: 'Intel',
};

function formatFeedTime(timestamp: string): string {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return timestamp;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function alertEvent(type: string): RhHubMovementFeedItem['event'] {
  const t = type.toLowerCase();
  if (t.includes('visit')) return 'visit';
  if (t.includes('offer')) return 'offer';
  return 'intel';
}

function movementIntelToFeed(data: MovementIntelResponse | null): RhHubMovementFeedItem[] {
  if (!data) return [];
  const items: RhHubMovementFeedItem[] = [];

  for (const alert of data.alerts ?? []) {
    items.push({
      id: alert.id,
      timestamp: alert.timestamp,
      name: alert.player,
      position: '—',
      class: ACTIVE_RECRUITING_CLASS_YEAR,
      profileUrl: '#',
      event: alertEvent(alert.type),
      summary: alert.detail,
    });
  }

  for (const riser of data.risers ?? []) {
    items.push({
      id: `rise-${riser.id}`,
      timestamp: riser.lastUpdate,
      name: riser.name,
      position: riser.position,
      class: ACTIVE_RECRUITING_CLASS_YEAR,
      profileUrl: playerHref({ slug: riser.slug, id: riser.id, name: riser.name }, 'recruiting', 'HIGH_SCHOOL'),
      event: 'up',
      summary: `UF ${riser.ufProb}% (+${riser.delta}% 7d) · ${riser.position}`,
    });
  }

  for (const faller of (data.fallers ?? []).slice(0, 4)) {
    items.push({
      id: `fall-${faller.id}`,
      timestamp: faller.lastUpdate,
      name: faller.name,
      position: faller.position,
      class: ACTIVE_RECRUITING_CLASS_YEAR,
      profileUrl: playerHref({ slug: faller.slug, id: faller.id, name: faller.name }, 'recruiting', 'HIGH_SCHOOL'),
      event: 'down',
      summary: `UF ${faller.ufProb}% (${faller.delta}% 7d) · ${faller.position}`,
    });
  }

  return items
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 16);
}

export function MovementIntelFeed(): React.ReactElement {
  const [payload, setPayload] = useState<MovementIntelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchMovementIntel()
      .then((res) => {
        if (!cancelled) setPayload(res);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const data = useMemo(() => movementIntelToFeed(payload), [payload]);

  return (
    <>
      <div className="rh-section-header">
        <div className="rh-section-title">Movement Intel</div>
        <div className="rh-section-subtitle">Live recruiting momentum across Florida&apos;s top targets.</div>
      </div>
      {loading ? (
        <div className="rh-skeleton" data-testid="rh-elite-movement-feed" aria-hidden="true" />
      ) : !data.length ? (
        <section className="rh-card" data-testid="rh-elite-movement-feed">
          <p className="rh-empty">
            {error ? 'Could not load movement intel.' : 'No movement intel available yet.'}
          </p>
        </section>
      ) : (
        <section className="rh-feed" data-testid="rh-elite-movement-feed">
          {data.map((item) => (
            <article key={item.id} className="rh-feed-item">
              <div className="rh-feed-time">{formatFeedTime(item.timestamp)}</div>
              <div className="rh-flex-between">
                <a href={item.profileUrl} className="rh-player-name">
                  {item.name}
                </a>
                <span className={`rh-badge rh-badge--event rh-badge--event-${item.event}`}>
                  {EVENT_LABELS[item.event]}
                </span>
              </div>
              <div className="rh-feed-summary">{item.summary}</div>
            </article>
          ))}
        </section>
      )}
    </>
  );
}
