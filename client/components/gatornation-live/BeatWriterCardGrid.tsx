'use client';

import React from 'react';
import type { LivePanelProps } from '@/lib/gatornation-live-types';
import { GNLModuleHead } from '@/components/gatornation-live/GNLModuleHead';
import { GNLDashBadge } from '@/components/gatornation-live/GNLDashBadge';

type BeatItem = LivePanelProps['items'][number];

function avatarInitials(name?: string, handle?: string): string {
  const raw = (name || handle || 'BW').replace(/^@/, '');
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return raw.slice(0, 2).toUpperCase();
}

function formatTimestamp(ts?: string): string {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d
    .toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    .toUpperCase();
}

type Props = {
  title: string;
  description?: string;
  items: BeatItem[];
};

/** Beat highlights — hidden when empty (no “0 highlights” cosplay). */
export function BeatWriterCardGrid({ title, description, items }: Props): React.ReactElement | null {
  const cards = items.slice(0, 3);
  if (!cards.length) return null;

  return (
    <div className="gv-gnl-beat-grid" data-testid="gnl-beat-writer-grid" id="beat-writers">
      <GNLModuleHead
        title={title}
        subtitle={description}
        badge={<GNLDashBadge label="BEAT" tone="beat" />}
        count={`${cards.length} highlights`}
      />
      <div className="gv-gnl-beat-grid__cards">
        {cards.map((item, idx) => (
          <article key={`${item.writerName ?? item.source}_${idx}`} className="gv-gnl-beat-card gv-gnl-beat-card--x">
            <div className="gv-gnl-beat-card__head">
              <span className="gv-gnl-beat-card__avatar" aria-hidden="true">
                {avatarInitials(item.writerName, item.handle)}
              </span>
              <div className="gv-gnl-beat-card__identity">
                <p className="gv-gnl-beat-card__writer">{item.writerName || item.handle || 'Beat Writer'}</p>
                {item.source ? (
                  <GNLDashBadge label={item.source.toUpperCase()} tone="beat" />
                ) : null}
              </div>
              {item.timestamp ? (
                <span className="gv-gnl-beat-card__time">{formatTimestamp(item.timestamp)}</span>
              ) : null}
            </div>
            <p className="gv-gnl-beat-card__text">{item.text}</p>
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="gv-gnl-beat-card__cta gv-gnl-beat-card__cta--x"
              >
                View on X →
              </a>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
