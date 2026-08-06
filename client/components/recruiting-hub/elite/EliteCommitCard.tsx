'use client';

import React from 'react';
import type { RhHubCommit } from '@/lib/recruiting-hub-elite-api';

type Props = {
  commit: RhHubCommit;
  year: number;
};

/** Strip API "Vault X —" prefix when present on legacy payloads. */
function stripVaultLabel(text: string | null | undefined, label: string): string | null {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const re = new RegExp(`^vault\\s+${label}\\s*[—\\-:]\\s*`, 'i');
  return raw.replace(re, '').trim() || raw;
}

function positionMark(position: string | null | undefined): string {
  const raw = String(position || '').trim().toUpperCase();
  if (!raw) return '—';
  // Keep short group labels readable in the mark tile.
  if (raw.length <= 4) return raw;
  return raw.slice(0, 3);
}

/**
 * Fan-first commit card — same surface for every class year.
 * Identity + short commit brief on card; Vault Scouting lives on the player profile.
 */
export function EliteCommitCard({ commit, year }: Props): React.ReactElement {
  const meta = commit.metaLine || commit.rankNote;
  const skinnyRaw = commit.skinny?.trim() || null;
  // Brief stays untitled — strip any legacy "Vault Eval —" prefix from API/iOS payloads.
  const skinny = stripVaultLabel(skinnyRaw, 'Eval');
  const showJersey = year <= 2026 && commit.jerseyNumber != null && String(commit.jerseyNumber).trim() !== '';
  const jerseyLabel = showJersey ? String(commit.jerseyNumber) : '—';
  const status = commit.statusBadge || (commit.enrolled ? 'Enrolled' : 'Signed');

  return (
    <article className="rh-commit-card rh-elite-commit-card" data-testid="rh-elite-commit-card">
      <a href={commit.profileUrl} className="rh-elite-commit-card__media" aria-label={`${commit.name} profile`}>
        <span className="rh-elite-commit-card__pos">{positionMark(commit.position)}</span>
        <span className="rh-elite-commit-card__jersey" aria-hidden>
          {jerseyLabel}
        </span>
        <span className="rh-elite-commit-card__status">{status}</span>
      </a>

      <div className="rh-elite-commit-card__body">
        <div className="rh-commit-header">
          <div>
            <a href={commit.profileUrl} className="rh-commit-name">
              {commit.name}
            </a>
            {meta ? <p className="rh-commit-meta">{meta}</p> : null}
          </div>
        </div>

        <div className="rh-commit-badges rh-elite-commit-card__badges">
          {commit.inState ? <span className="rh-badge rh-badge--instate">In-state</span> : null}
          {commit.stars != null && commit.stars > 0 ? (
            <span className="rh-badge">{commit.stars}★</span>
          ) : null}
          {commit.position ? <span className="rh-badge">{commit.position}</span> : null}
        </div>

        {skinny ? <p className="rh-commit-strengths rh-commit-skinny">{skinny}</p> : null}

        <div className="rh-commit-footer">
          <span>Committed {commit.commitDate}</span>
          {commit.rating && commit.rating !== '—' ? <span className="rh-elite-commit-card__rating">{commit.rating}</span> : null}
          {commit.nilEstimate ? <span>NIL {commit.nilEstimate}</span> : null}
        </div>
      </div>
    </article>
  );
}
