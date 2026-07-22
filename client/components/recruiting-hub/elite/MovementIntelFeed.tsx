'use client';

import React, { useCallback } from 'react';
import type { RhHubMovementFeedItem } from '@/lib/recruiting-hub-elite-api';
import { fetchRecruitingHubMovementFeed } from '@/lib/recruiting-hub-elite-api';
import { useRecruitingClassYear } from '@/lib/recruiting-class-year-store';
import { useHubBundleSection } from '@/components/recruiting-hub/elite/useHubBundleSection';
import { UiWarming } from '@/components/site/UiMessage';

const EVENT_LABELS: Record<RhHubMovementFeedItem['event'], string> = {
  up: 'Trending Up',
  down: 'Trending Down',
  visit: 'Visit scheduled',
  offer: 'New offer',
  intel: 'Board intel',
  commit: 'Commit',
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
  const { activeYear } = useRecruitingClassYear();
  const selectFeed = useCallback((b: { movementFeed: RhHubMovementFeedItem[] }) => b.movementFeed, []);
  const fetchFeed = useCallback(
    (year: number) => fetchRecruitingHubMovementFeed(year),
    []
  );
  const { data, loading, error } = useHubBundleSection({
    select: selectFeed,
    fetchFallback: fetchFeed,
  });

  const items = data ?? [];

  return (
    <>
      <div className="rh-section-header">
        <div className="rh-section-title">Who&apos;s moving</div>
        <div className="rh-section-subtitle">
          Fresh board traction for the {activeYear} class — offers, visits, commits, and swings.
        </div>
      </div>
      {loading ? (
        <div className="rh-hub-warming" role="status" aria-live="polite" aria-busy="true">
          <UiWarming hint="Loading board movement…" />
        </div>
      ) : !items.length ? (
        <section className="rh-card" data-testid="rh-elite-movement-feed">
          <p className="rh-empty">
            {error ? 'Could not load board movement.' : 'No recent movement for this class yet.'}
          </p>
        </section>
      ) : (
        <section className="rh-feed" data-testid="rh-elite-movement-feed">
          {items.map((item) => (
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
              {item.summary ? <div className="rh-feed-summary">{item.summary}</div> : null}
              {item.movementNarrative ? (
                <div className="rh-feed-narrative">{item.movementNarrative}</div>
              ) : null}
            </article>
          ))}
        </section>
      )}
    </>
  );
}
