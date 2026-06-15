'use client';

import React, { useState } from 'react';
import type { StaffNote } from '@/lib/futurecast-board-types';
import { FC_METRIC_LABELS, formatFitPercent } from '@/lib/futurecast-elite-metrics';
import { playerProfilePath } from '@/lib/player-routes';
import { isFutureCastInsider } from '@/lib/futurecast-insider';

type Props = {
  note: StaffNote;
  blurred?: boolean;
};

const PRIORITY_ICONS: Record<string, string> = {
  high: '/icons/priority-high.svg',
  medium: '/icons/priority-medium.svg',
  low: '/icons/priority-low.svg',
};

export function StaffNoteCard({ note, blurred }: Props): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const text =
    note.notePreview ||
    note.note ||
    note.staffNotes ||
    note.insiderNotes ||
    note.projection ||
    '';
  const priority = note.priority ?? 'medium';
  const href = playerProfilePath(note.playerSlug, 'HIGH_SCHOOL', true, note.playerName, 'futurecast');
  const insider = isFutureCastInsider();
  const showFull = insider && !blurred;
  const preview = text.length > 120 && !expanded ? `${text.slice(0, 120)}…` : text;
  const displayText = showFull ? preview : `${text.slice(0, 80)}…`;
  const canExpand = showFull && text.length > 120;

  return (
    <a href={href} className="gv-staff-note__wrap">
      <article className="gv-card gv-staff-note gv-fade-in">
        <div className="gv-staff-note-header">
          <div>
            <h3 className="gv-staff-note-name">{note.playerName}</h3>
            <p className="gv-staff-note-meta">
              {[
                note.compositeScore && note.compositeScore > 0
                  ? `${note.compositeScore.toFixed(2)} comp`
                  : null,
                note.position,
                note.school,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <span className={`gv-staff-note-priority gv-staff-note-priority--${priority}`}>
            <img src={PRIORITY_ICONS[priority] ?? PRIORITY_ICONS.medium} alt="" width={14} height={14} />
            {priority}
          </span>
        </div>
        {text ? (
          <p className={`gv-staff-note-body${!showFull ? ' gv-staff-note-body--blurred' : ''}`}>
            {displayText}
          </p>
        ) : null}
        {canExpand ? (
          <button
            type="button"
            className="gv-staff-note-toggle"
            onClick={(e) => {
              e.preventDefault();
              setExpanded((v) => !v);
            }}
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        ) : null}
        <div className="gv-staff-note-foot">
          {insider && note.fitScore != null ? (
            <span className="gv-staff-note-fit">
              {FC_METRIC_LABELS.fit} {formatFitPercent(note.fitScore)}
              {note.trendDelta7d != null ? (
                <img
                  src={note.trendDelta7d >= 0 ? '/icons/trending-up.svg' : '/icons/trending-down.svg'}
                  alt=""
                  width={14}
                  height={14}
                />
              ) : null}
            </span>
          ) : null}
          {note.updatedAt ? (
            <time className="gv-staff-note-time" dateTime={note.updatedAt}>
              {new Date(note.updatedAt).toLocaleDateString()}
            </time>
          ) : null}
        </div>
      </article>
    </a>
  );
}
