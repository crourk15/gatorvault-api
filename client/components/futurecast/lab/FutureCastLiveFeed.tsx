'use client';

import React, { useMemo } from 'react';
import type { MasterBoardResponse, MovementIntelResponse, StaffNotesResponse } from '@/lib/futurecast-board-types';
import {
  buildIntelFeedItem,
  dedupeIntelFeedItems,
  formatIntelTimestamp,
} from '@/lib/recruiting-intel-feed';
import { ufPctFromFc } from './fc-lab-types';

function formatTrendDelta(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return 'TBD';
  const rounded = Math.round(value);
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

type Props = {
  masterBoard: MasterBoardResponse;
  staffNotes: StaffNotesResponse;
  movementIntel: MovementIntelResponse;
};

export function FutureCastLiveFeed({
  masterBoard,
  staffNotes,
  movementIntel,
}: Props): React.ReactElement {
  const items = useMemo(() => {
    const raw = [];
    const bySlug = new Map(masterBoard.players.map((p) => [p.slug, p]));

    for (const p of masterBoard.players.slice(0, 4)) {
      if (p.committedTo && /\bflorida\b|\bgators\b/i.test(String(p.committedTo))) continue;
      const pct = ufPctFromFc(p.ufConfidence);
      raw.push(
        buildIntelFeedItem({
          id: `fc-model-${p.slug}`,
          playerName: p.name,
          headline: `FutureCast model → UF ${pct}% for ${p.name} (${p.position})`,
          timestamp: masterBoard.updatedAt,
          category: 'Movement',
        })
      );
    }

    for (const riser of movementIntel.risers.slice(0, 2)) {
      raw.push(
        buildIntelFeedItem({
          id: `fc-rise-${riser.slug}`,
          playerName: riser.name,
          headline: `Prediction trending up for ${riser.name} (${formatTrendDelta(riser.trendDelta7d)})`,
          timestamp: movementIntel.updatedAt,
          category: 'Movement',
        })
      );
    }

    for (const note of staffNotes.notes.slice(0, 3)) {
      const player = bySlug.get(note.playerSlug);
      const pct = player ? ufPctFromFc(player.ufConfidence) : null;
      raw.push(
        buildIntelFeedItem({
          id: `fc-note-${note.playerSlug}-${note.notePreview || note.note}`,
          playerName: note.playerName,
          headline: `Staff note on ${note.playerName}${pct != null ? ` — UF ${pct}%` : ''}: ${note.notePreview ?? note.note ?? 'Updated'}`,
          timestamp: staffNotes.updatedAt,
          category: 'Staff Note',
        })
      );
    }

    for (const alert of movementIntel.alerts.slice(0, 2)) {
      raw.push(
        buildIntelFeedItem({
          id: alert.id,
          headline: alert.message,
          timestamp: alert.createdAt,
          category: 'Movement',
          volatile: /volatile|spike/i.test(alert.message),
        })
      );
    }

    for (const faller of movementIntel.fallers.slice(0, 1)) {
      raw.push(
        buildIntelFeedItem({
          id: `fc-fall-${faller.slug}`,
          playerName: faller.name,
          headline: `Prediction cooling on ${faller.name} (${formatTrendDelta(faller.trendDelta7d)})`,
          timestamp: movementIntel.updatedAt,
          category: 'Movement',
        })
      );
    }

    const deduped = dedupeIntelFeedItems(raw, 16);
    if (deduped.length < 4) {
      deduped.push(
        buildIntelFeedItem({
          id: 'fc-feed-placeholder',
          headline: 'FutureCast Lab live — predictions refresh every 90 seconds',
          category: 'Update',
        })
      );
    }

    return deduped;
  }, [masterBoard, movementIntel, staffNotes.notes, staffNotes.updatedAt]);

  return (
    <section className="rh-cc-feed fc-lab-feed fc-lab-bleed" data-testid="fc-lab-live-feed">
      <div className="fc-lab-feed__inner rh-cc-feed__inner rh-frame">
        <h2 className="rh-cc-feed__title fc-lab-feed__title">FutureCast Live Feed</h2>
        <div className="fc-lab-feed__track rh-cc-feed__track" tabIndex={0} role="list" aria-label="FutureCast live feed">
          {items.map((item) => (
            <div key={item.id} className="fc-lab-feed__item rh-cc-feed__item" role="listitem">
              <span className="fc-lab-feed__icon rh-cc-feed__icon" aria-hidden>
                {item.icon}
              </span>
              <div className="rh-cc-feed__body">
                <span className="fc-lab-feed__text rh-cc-feed__text">{item.headline}</span>
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
