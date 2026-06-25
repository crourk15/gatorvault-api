'use client';

import React from 'react';
import type { StaffNotesResponse } from '@/lib/futurecast-board-types';
import { latestPlayerIntelTimeline } from '@/lib/player-intel-timeline';
import { formatIntelTimestamp } from '@/lib/recruiting-intel-feed';

type Props = {
  slug: string;
  staffNotes: StaffNotesResponse;
};

export function PlayerIntelTimelineStrip({ slug, staffNotes }: Props): React.ReactElement | null {
  const entry = latestPlayerIntelTimeline(slug, staffNotes);
  if (!entry) return null;

  return (
    <p className="fc-player-intel-timeline" data-testid="fc-player-intel-timeline">
      <span className="fc-player-intel-timeline__label">{entry.label}</span>
      {' · '}
      {entry.preview}
      {entry.timestamp ? (
        <>
          {' · '}
          <time dateTime={entry.timestamp}>{formatIntelTimestamp(entry.timestamp)}</time>
        </>
      ) : null}
    </p>
  );
}