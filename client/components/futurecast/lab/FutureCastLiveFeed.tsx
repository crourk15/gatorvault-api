'use client';

import React, { useMemo } from 'react';
import type { MasterBoardResponse, MovementIntelResponse, StaffNotesResponse } from '@/lib/futurecast-board-types';
import { ufPctFromFc } from './fc-lab-types';

type Props = {
  masterBoard: MasterBoardResponse;
  staffNotes: StaffNotesResponse;
  movementIntel: MovementIntelResponse;
};

type FeedItem = { icon: string; text: string };

export function FutureCastLiveFeed({
  masterBoard,
  staffNotes,
  movementIntel,
}: Props): React.ReactElement {
  const items = useMemo(() => {
    const feed: FeedItem[] = [];
    const bySlug = new Map(masterBoard.players.map((p) => [p.slug, p]));

    for (const p of masterBoard.players.slice(0, 4)) {
      const pct = ufPctFromFc(p.ufConfidence);
      feed.push({
        icon: '🎯',
        text: `FutureCast model → UF ${pct}% for ${p.name} (${p.position})`,
      });
    }

    for (const riser of movementIntel.risers.slice(0, 2)) {
      feed.push({
        icon: '🔁',
        text: `Prediction trending up for ${riser.name} (+${Math.round(riser.trendDelta7d)}%)`,
      });
    }

    for (const note of staffNotes.notes.slice(0, 3)) {
      const player = bySlug.get(note.playerSlug);
      const pct = player ? ufPctFromFc(player.ufConfidence) : null;
      feed.push({
        icon: '📝',
        text: `Staff note on ${note.playerName}${pct != null ? ` — UF ${pct}%` : ''}: ${note.notePreview ?? note.note ?? 'Updated'}`,
      });
    }

    for (const alert of movementIntel.alerts.slice(0, 2)) {
      feed.push({
        icon: '⚠️',
        text: alert.message,
      });
    }

    for (const faller of movementIntel.fallers.slice(0, 1)) {
      feed.push({
        icon: '🔁',
        text: `Prediction cooling on ${faller.name} (${Math.round(faller.trendDelta7d)}%)`,
      });
    }

    if (feed.length < 4) {
      feed.push({
        icon: 'ℹ️',
        text: 'FutureCast Lab live — predictions refresh every 90 seconds',
      });
    }

    return feed.slice(0, 16);
  }, [masterBoard.players, movementIntel, staffNotes.notes]);

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
