'use client';

import React from 'react';
import type { Coach, Era } from '@/lib/team-hub-types';

type CoachModalProps = {
  coach: Coach | null;
  onClose: () => void;
};

type EraModalProps = {
  era: Era | null;
  onClose: () => void;
};

export function CoachingStaffModal({ coach, onClose }: CoachModalProps): React.ReactElement | null {
  if (!coach) return null;

  return (
    <div
      className="gv-team-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="team-coach-modal-title"
      onClick={onClose}
    >
      <div className="gv-team-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="gv-team-modal__close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 id="team-coach-modal-title" className="gv-team-modal__title">
          {coach.name}
        </h2>
        <p className="gv-team-modal__subtitle">{coach.title}</p>
        <div className="gv-team-modal__body">
          {coach.bio ? <p>{coach.bio}</p> : <p>2026 Florida Gators coaching staff.</p>}
          {coach.highlights && coach.highlights.length > 0 && (
            <ul className="gv-team-modal__list">
              {coach.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export function EraDetailModal({ era, onClose }: EraModalProps): React.ReactElement | null {
  if (!era) return null;

  return (
    <div
      className="gv-team-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="team-era-modal-title"
      onClick={onClose}
    >
      <div className="gv-team-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="gv-team-modal__close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <p className="gv-team-modal__subtitle">{era.label}</p>
        <h2 id="team-era-modal-title" className="gv-team-modal__title">
          {era.title}
        </h2>
        <div className="gv-team-modal__body">
          {era.description && <p>{era.description}</p>}
          {era.highlights && era.highlights.length > 0 && (
            <ul className="gv-team-modal__list">
              {era.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
