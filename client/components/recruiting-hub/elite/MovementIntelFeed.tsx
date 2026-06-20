'use client';

import React, { useCallback } from 'react';
import {
  fetchRecruitingHubMovementFeed,
  type RhHubMovementFeedItem,
} from '@/lib/recruiting-hub-elite-api';
import { useRecruitingHubQuery } from '@/components/recruiting-hub/elite/useRecruitingHubQuery';

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

export function MovementIntelFeed(): React.ReactElement {
  const loadFeed = useCallback(() => fetchRecruitingHubMovementFeed(), []);
  const { data, loading, error } = useRecruitingHubQuery<RhHubMovementFeedItem[]>(loadFeed);

  return (
    <>
      <div className="rh-section-header">
        <div className="rh-section-title">Movement Intel</div>
        <div className="rh-section-subtitle">Live recruiting momentum across Florida&apos;s top targets.</div>
      </div>
      {loading ? (
        <div className="rh-skeleton" data-testid="rh-elite-movement-feed" aria-hidden="true" />
      ) : !data ? (
        <section className="rh-card" data-testid="rh-elite-movement-feed">
          <p className="rh-empty">{error ? 'Could not load movement intel.' : 'Movement feed updating — check back shortly.'}</p>
        </section>
      ) : !data.length ? (
        <section className="rh-card" data-testid="rh-elite-movement-feed">
          <p className="rh-empty">Movement feed updating — check back shortly.</p>
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
