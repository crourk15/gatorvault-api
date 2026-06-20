'use client';

import React from 'react';
import type { RhPositionRoomView } from '@/components/recruiting-hub/elite/rh-elite-utils';

type Props = {
  rooms: RhPositionRoomView[];
  loading?: boolean;
};

export function RecruitingPositionSnapshot({ rooms, loading }: Props): React.ReactElement {
  return (
    <>
      <div className="rh-section-header">
        <div className="rh-section-title">Position Room Snapshot</div>
        <div className="rh-section-subtitle">Commits and key targets by position.</div>
      </div>
      {loading ? (
        <div className="rh-skeleton" data-testid="rh-elite-position-snapshot" aria-hidden="true" />
      ) : rooms.length === 0 ? (
        <section className="rh-card" data-testid="rh-elite-position-snapshot">
          <p className="rh-empty">Position breakdown loading.</p>
        </section>
      ) : (
        <section className="rh-position-grid" data-testid="rh-elite-position-snapshot">
          {rooms.map((room) => (
            <article key={room.id} className="rh-position-card">
              <div className="rh-position-label">{room.label}</div>
              <div className="rh-position-meta">
                {room.commits} commits · {room.targets} key targets
              </div>
              <div className="rh-metric-trend">{room.note}</div>
            </article>
          ))}
        </section>
      )}
    </>
  );
}
